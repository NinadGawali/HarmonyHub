const votingService = require('../services/votingService');

const userChannel = (userId) => `user:${userId}`;

// Expose expected, user-facing errors; hide unexpected ones behind a generic message.
const errorMessage = (error, fallback) => (
  error instanceof votingService.RoomNotFoundError ? error.message : fallback
);

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    // Join a room. Accepts a bare roomId (legacy) or { roomId, userId }.
    socket.on('join_room', async (payload) => {
      try {
        const { roomId, userId } = typeof payload === 'string' ? { roomId: payload } : (payload || {});

        if (!roomId) {
          socket.emit('error', { message: 'Room ID is required' });
          return;
        }

        socket.join(roomId);
        if (userId) {
          // Per-user channel so request outcomes reach only the requester.
          socket.join(userChannel(userId));
        }

        const [leaderboard, votingOpen, pendingRequests, myVotes] = await Promise.all([
          votingService.getLeaderboard(roomId),
          votingService.getVotingStatus(roomId),
          votingService.getPendingSongRequests(roomId),
          userId ? votingService.getUserVotes(roomId, userId) : []
        ]);

        socket.emit('leaderboard_update', leaderboard);
        socket.emit('voting_status_changed', { isOpen: votingOpen });
        socket.emit('song_requests_updated', pendingRequests);
        socket.emit('my_votes', { songIds: myVotes });

        socket.to(roomId).emit('user_joined', {
          userId: socket.id,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Vote for a song
    socket.on('vote_song', async (data) => {
      const { roomId, songId, userId } = data || {};

      const reject = (code, message) => socket.emit('vote_rejected', { songId, code, message });

      if (!roomId || !songId || !userId) {
        reject('INVALID', 'Invalid vote data');
        return;
      }

      try {
        const votingOpen = await votingService.getVotingStatus(roomId);
        if (!votingOpen) {
          reject('VOTING_CLOSED', 'Voting is closed');
          return;
        }

        const leaderboard = await votingService.voteSong(roomId, songId, userId);

        io.to(roomId).emit('leaderboard_update', leaderboard);
        socket.emit('vote_success', { songId });
      } catch (error) {
        if (error instanceof votingService.VoteError) {
          reject(error.code, error.message);
          return;
        }

        console.error('Error voting for song:', error);
        reject('SERVER_ERROR', 'Failed to vote for song');
      }
    });

    // Add song to room (admin only)
    socket.on('add_song', async (data) => {
      try {
        const { roomId, songData } = data;

        if (!roomId || !songData) {
          socket.emit('error', { message: 'Invalid song data' });
          return;
        }

        await votingService.addSongToRoom(roomId, songData);

        // Get updated leaderboard
        const leaderboard = await votingService.getLeaderboard(roomId);

        // Broadcast updated leaderboard to all users in the room
        io.to(roomId).emit('leaderboard_update', leaderboard);

        console.log(`Song added to room ${roomId}: ${songData.title}`);
      } catch (error) {
        console.error('Error adding song:', error);
        socket.emit('error', { message: errorMessage(error, 'Failed to add song') });
      }
    });

    // Remove song from room (admin only)
    socket.on('remove_song', async (data) => {
      try {
        const { roomId, songId } = data;

        if (!roomId || !songId) {
          socket.emit('error', { message: 'Invalid data' });
          return;
        }

        await votingService.removeSongFromRoom(roomId, songId);

        // Get updated leaderboard
        const leaderboard = await votingService.getLeaderboard(roomId);

        // Broadcast updated leaderboard to all users in the room
        io.to(roomId).emit('leaderboard_update', leaderboard);

        console.log(`Song removed from room ${roomId}: ${songId}`);
      } catch (error) {
        console.error('Error removing song:', error);
        socket.emit('error', { message: 'Failed to remove song' });
      }
    });

    // Toggle voting status (admin only)
    socket.on('toggle_voting', async (data) => {
      try {
        const { roomId, isOpen } = data;

        if (!roomId || isOpen === undefined) {
          socket.emit('error', { message: 'Invalid data' });
          return;
        }

        await votingService.setVotingStatus(roomId, isOpen);

        // Broadcast to all users in the room
        io.to(roomId).emit('voting_status_changed', { isOpen });

        console.log(`Voting ${isOpen ? 'opened' : 'closed'} for room ${roomId}`);
      } catch (error) {
        console.error('Error toggling voting:', error);
        socket.emit('error', { message: errorMessage(error, 'Failed to toggle voting') });
      }
    });

    // Relay Spotify playback commands to all clients in a room.
    socket.on('spotify_control', (data) => {
      try {
        const { roomId, action, payload } = data || {};

        if (!roomId || !action) {
          socket.emit('error', { message: 'Invalid Spotify control payload' });
          return;
        }

        io.to(roomId).emit('spotify_control', {
          action,
          payload: payload || {},
          originSocketId: socket.id,
          serverTimestamp: Date.now()
        });
      } catch (error) {
        console.error('Error relaying Spotify control event:', error);
        socket.emit('error', { message: 'Failed to relay Spotify control event' });
      }
    });

    // Relay periodic playback state snapshots to tighten drift between clients.
    socket.on('spotify_sync_state', (data) => {
      try {
        const { roomId, trackUri, positionMs, isPaused } = data || {};

        if (!roomId || !trackUri) {
          socket.emit('error', { message: 'Invalid Spotify sync payload' });
          return;
        }

        socket.to(roomId).emit('spotify_sync_state', {
          trackUri,
          positionMs: Number(positionMs || 0),
          isPaused: Boolean(isPaused),
          originSocketId: socket.id,
          serverTimestamp: Date.now()
        });
      } catch (error) {
        console.error('Error relaying Spotify sync event:', error);
        socket.emit('error', { message: 'Failed to relay Spotify sync event' });
      }
    });

    // Submit song request (participant)
    socket.on('submit_song_request', async (data) => {
      try {
        const { roomId, userId, userName, query } = data || {};

        if (!roomId || !userId || !query || !query.trim()) {
          socket.emit('error', { message: 'Invalid request data' });
          return;
        }

        const request = await votingService.submitSongRequest(roomId, {
          userId,
          userName,
          query: query.trim()
        });

        const pendingRequests = await votingService.getPendingSongRequests(roomId);
        io.to(roomId).emit('song_requests_updated', pendingRequests);

        socket.emit('song_request_submitted', {
          requestId: request.requestId,
          message: 'Request sent to admin'
        });
      } catch (error) {
        console.error('Error submitting song request:', error);
        socket.emit('error', { message: errorMessage(error, 'Failed to submit song request') });
      }
    });

    // Get pending song requests
    socket.on('get_song_requests', async (data) => {
      try {
        const { roomId } = data || {};

        if (!roomId) {
          socket.emit('error', { message: 'Invalid room data' });
          return;
        }

        const pendingRequests = await votingService.getPendingSongRequests(roomId);
        socket.emit('song_requests_updated', pendingRequests);
      } catch (error) {
        console.error('Error fetching song requests:', error);
        socket.emit('error', { message: error.message || 'Failed to fetch song requests' });
      }
    });

    // Approve song request (admin)
    socket.on('approve_song_request', async (data) => {
      try {
        const { roomId, requestId } = data || {};

        if (!roomId || !requestId) {
          socket.emit('error', { message: 'Invalid request approval data' });
          return;
        }

        const approved = await votingService.approveSongRequest(roomId, requestId);
        const leaderboard = await votingService.getLeaderboard(roomId);
        const pendingRequests = await votingService.getPendingSongRequests(roomId);

        io.to(roomId).emit('leaderboard_update', leaderboard);
        io.to(roomId).emit('song_requests_updated', pendingRequests);
        const outcome = {
          requestId,
          status: 'approved',
          songTitle: approved.songData.title
        };
        socket.emit('song_request_processed', outcome);
        if (approved.requesterId) {
          io.to(userChannel(approved.requesterId)).emit('song_request_processed', outcome);
        }
      } catch (error) {
        console.error('Error approving song request:', error);
        socket.emit('error', { message: error.message || 'Failed to approve song request' });
      }
    });

    // Reject song request (admin)
    socket.on('reject_song_request', async (data) => {
      try {
        const { roomId, requestId } = data || {};

        if (!roomId || !requestId) {
          socket.emit('error', { message: 'Invalid request rejection data' });
          return;
        }

        const rejected = await votingService.rejectSongRequest(roomId, requestId);
        const pendingRequests = await votingService.getPendingSongRequests(roomId);

        io.to(roomId).emit('song_requests_updated', pendingRequests);

        const outcome = { requestId, status: 'rejected' };
        socket.emit('song_request_processed', outcome);
        if (rejected.requesterId) {
          io.to(userChannel(rejected.requesterId)).emit('song_request_processed', outcome);
        }
      } catch (error) {
        console.error('Error rejecting song request:', error);
        socket.emit('error', { message: error.message || 'Failed to reject song request' });
      }
    });

    // Leave room
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
      console.log(`User ${socket.id} left room ${roomId}`);

      // Notify others in the room
      socket.to(roomId).emit('user_left', {
        userId: socket.id,
        timestamp: new Date().toISOString()
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });
};
