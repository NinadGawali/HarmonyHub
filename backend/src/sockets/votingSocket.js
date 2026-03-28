const votingService = require('../services/votingService');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    // Join a room
    socket.on('join_room', async (roomId) => {
      try {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);

        // Send current leaderboard to the joined user
        const leaderboard = await votingService.getLeaderboard(roomId);
        socket.emit('leaderboard_update', leaderboard);

        // Send pending song requests to the joined user
        const pendingRequests = await votingService.getPendingSongRequests(roomId);
        socket.emit('song_requests_updated', pendingRequests);

        // Notify others in the room
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
      try {
        const { roomId, songId, userId } = data;

        if (!roomId || !songId || !userId) {
          socket.emit('error', { message: 'Invalid vote data' });
          return;
        }

        // Check if voting is open
        const votingOpen = await votingService.getVotingStatus(roomId);
        if (!votingOpen) {
          socket.emit('error', { message: 'Voting is closed' });
          return;
        }

        // Update vote count (with duplicate check)
        const leaderboard = await votingService.voteSong(roomId, songId, userId);

        // Broadcast updated leaderboard to all users in the room
        io.to(roomId).emit('leaderboard_update', leaderboard);

        // Confirm vote to the user
        socket.emit('vote_success', { songId });

        console.log(`Vote recorded: Room ${roomId}, Song ${songId}, User ${userId}`);
      } catch (error) {
        console.error('Error voting for song:', error);
        socket.emit('error', { message: error.message || 'Failed to vote for song' });
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

        console.log(`🎵 Adding song - Preview URL received: ${songData.previewUrl || 'NULL'}`);
        await votingService.addSongToRoom(roomId, songData);

        // Get updated leaderboard
        const leaderboard = await votingService.getLeaderboard(roomId);

        // Broadcast updated leaderboard to all users in the room
        io.to(roomId).emit('leaderboard_update', leaderboard);

        console.log(`Song added to room ${roomId}: ${songData.title}`);
      } catch (error) {
        console.error('Error adding song:', error);
        socket.emit('error', { message: 'Failed to add song' });
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
        socket.emit('error', { message: 'Failed to toggle voting' });
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
        socket.emit('error', { message: error.message || 'Failed to submit song request' });
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
        io.to(roomId).emit('song_request_processed', {
          requestId,
          status: 'approved',
          songTitle: approved.songData.title
        });
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

        await votingService.rejectSongRequest(roomId, requestId);
        const pendingRequests = await votingService.getPendingSongRequests(roomId);

        io.to(roomId).emit('song_requests_updated', pendingRequests);
        io.to(roomId).emit('song_request_processed', {
          requestId,
          status: 'rejected'
        });
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
