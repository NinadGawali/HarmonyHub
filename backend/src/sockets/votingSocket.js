const votingService = require('../services/votingService');
const { authenticateSocket } = require('./socketAuth');
const { allowRequest } = require('../utils/rateLimit');
const { config } = require('../config/env');
const { RecommenderUnavailableError, generatePlaylist } = require('../services/playlistRecommendationService');

const MAX_REQUEST_QUERY_LENGTH = 200;
const SONG_REQUESTS_PER_MINUTE = 5;
const MAX_AI_PROMPT_LENGTH = 300;
const DEFAULT_AI_FILL_COUNT = 10;

// Per-user channel, so request outcomes reach only the requester (on every device).
const userChannel = (userId) => `user:${userId}`;
// Host-only channel for the pending song request queue.
const hostChannel = (roomId) => `host:${roomId}`;

// Errors whose message is safe and useful to show to the user.
class ClientError extends Error {}

const assertValue = (condition, message) => {
  if (!condition) throw new ClientError(message);
};

module.exports = (io) => {
  io.use(authenticateSocket);

  const broadcastLeaderboard = async (roomId) => {
    io.to(roomId).emit('leaderboard_update', await votingService.getLeaderboard(roomId));
  };

  const broadcastPendingRequests = async (roomId) => {
    io.to(hostChannel(roomId)).emit('song_requests_updated', await votingService.getPendingSongRequests(roomId));
  };

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(userChannel(user.id));

    const assertMember = (roomId) => {
      assertValue(roomId && socket.rooms.has(roomId), 'Join the room first');
    };

    const assertHost = async (roomId) => {
      assertMember(roomId);
      if (!(await votingService.roomExists(roomId))) {
        throw new votingService.RoomNotFoundError(roomId);
      }
      assertValue(await votingService.isRoomHost(roomId, user.id), 'Only the host can do that');
    };

    // Registers a handler with uniform error reporting.
    const on = (event, handler, fallbackMessage) => {
      socket.on(event, async (payload) => {
        try {
          await handler(payload || {});
        } catch (error) {
          if (error instanceof ClientError || error instanceof votingService.RoomNotFoundError) {
            socket.emit('error', { event, message: error.message });
            return;
          }
          console.error(`Socket "${event}" failed:`, error);
          socket.emit('error', { event, message: fallbackMessage });
        }
      });
    };

    // Accepts { roomId } (or a bare roomId string from older clients).
    on('join_room', async (payload) => {
      const roomId = typeof payload === 'string' ? payload : payload.roomId;
      assertValue(roomId, 'Room ID is required');
      if (!(await votingService.roomExists(roomId))) {
        throw new votingService.RoomNotFoundError(roomId);
      }

      const isHost = await votingService.isRoomHost(roomId, user.id);
      socket.join(roomId);
      if (isHost) {
        socket.join(hostChannel(roomId));
      }
      await votingService.addRoomMember(roomId, user.id);

      const [leaderboard, votingOpen, myVotes] = await Promise.all([
        votingService.getLeaderboard(roomId),
        votingService.getVotingStatus(roomId),
        votingService.getUserVotes(roomId, user.id)
      ]);

      socket.emit('room_joined', { roomId, isHost, user: { id: user.id, displayName: user.displayName } });
      socket.emit('leaderboard_update', leaderboard);
      socket.emit('voting_status_changed', { isOpen: votingOpen });
      socket.emit('my_votes', { songIds: myVotes });
      if (isHost) {
        socket.emit('song_requests_updated', await votingService.getPendingSongRequests(roomId));
      }
    }, 'Failed to join room');

    socket.on('vote_song', async ({ roomId, songId } = {}) => {
      const reject = (code, message) => socket.emit('vote_rejected', { songId, code, message });

      if (!roomId || !songId || !socket.rooms.has(roomId)) {
        reject('INVALID', 'Invalid vote');
        return;
      }

      try {
        if (!(await votingService.getVotingStatus(roomId))) {
          reject('VOTING_CLOSED', 'Voting is closed');
          return;
        }

        const { leaderboard, voted } = await votingService.voteSong(roomId, songId, user.id);
        io.to(roomId).emit('leaderboard_update', leaderboard);
        socket.emit('vote_success', { songId, voted });
      } catch (error) {
        if (error instanceof votingService.VoteError) {
          reject(error.code, error.message);
          return;
        }
        console.error('Error voting for song:', error);
        reject('SERVER_ERROR', 'Failed to vote for song');
      }
    });

    on('add_song', async ({ roomId, songData }) => {
      await assertHost(roomId);
      assertValue(songData?.songId && songData.title && songData.artist, 'Song data is incomplete');
      await votingService.addSongToRoom(roomId, songData);
      await broadcastLeaderboard(roomId);
    }, 'Failed to add song');

    // The host describes a vibe; the recommender's songs are added to the room for guests to vote on.
    on('ai_fill_queue', async ({ roomId, prompt, count }) => {
      await assertHost(roomId);
      const text = typeof prompt === 'string' ? prompt.trim() : '';
      assertValue(text, 'Describe the songs you want');
      assertValue(text.length <= MAX_AI_PROMPT_LENGTH, `Keep it under ${MAX_AI_PROMPT_LENGTH} characters`);
      // Shares the per-user AI budget with playlist generation.
      assertValue(
        await allowRequest(`playlist-generate:${user.id}`, config.recommender.generationsPerMinute, 60),
        'You are asking the AI very quickly. Wait a minute and try again.'
      );

      let playlist;
      try {
        playlist = await generatePlaylist({ prompt: text, count: count || DEFAULT_AI_FILL_COUNT, market: user.country });
      } catch (error) {
        if (error instanceof RecommenderUnavailableError) throw new ClientError(error.message);
        throw error;
      }

      const inRoom = new Set((await votingService.getLeaderboard(roomId)).map((song) => song.songId));
      const fresh = playlist.songs.filter((song) => !inRoom.has(song.songId));
      for (const song of fresh) {
        await votingService.addSongToRoom(roomId, song);
      }
      if (fresh.length) await broadcastLeaderboard(roomId);

      socket.emit('ai_fill_done', {
        added: fresh.length,
        skipped: playlist.songs.length - fresh.length,
        message: playlist.message,
        usedFallback: playlist.usedFallback
      });
    }, 'The AI could not add songs right now');

    on('remove_song', async ({ roomId, songId }) => {
      await assertHost(roomId);
      assertValue(songId, 'Song ID is required');
      await votingService.removeSongFromRoom(roomId, songId);
      await broadcastLeaderboard(roomId);
    }, 'Failed to remove song');

    on('toggle_voting', async ({ roomId, isOpen }) => {
      await assertHost(roomId);
      assertValue(typeof isOpen === 'boolean', 'isOpen must be true or false');
      await votingService.setVotingStatus(roomId, isOpen);
      io.to(roomId).emit('voting_status_changed', { isOpen });
    }, 'Failed to toggle voting');

    // Relay Spotify playback commands from the host to everyone in the room.
    on('spotify_control', async ({ roomId, action, payload }) => {
      await assertHost(roomId);
      assertValue(action, 'Action is required');
      io.to(roomId).emit('spotify_control', {
        action,
        payload: payload || {},
        originSocketId: socket.id,
        serverTimestamp: Date.now()
      });
    }, 'Failed to relay Spotify control event');

    // Relay periodic playback snapshots from the host to reduce drift between clients.
    on('spotify_sync_state', async ({ roomId, trackUri, positionMs, isPaused }) => {
      await assertHost(roomId);
      assertValue(trackUri, 'Track URI is required');
      socket.to(roomId).emit('spotify_sync_state', {
        trackUri,
        positionMs: Number(positionMs || 0),
        isPaused: Boolean(isPaused),
        originSocketId: socket.id,
        serverTimestamp: Date.now()
      });
    }, 'Failed to relay Spotify sync event');

    on('submit_song_request', async ({ roomId, query }) => {
      assertMember(roomId);
      const text = typeof query === 'string' ? query.trim() : '';
      assertValue(text, 'Enter a song name or Spotify link');
      assertValue(text.length <= MAX_REQUEST_QUERY_LENGTH, `Requests are limited to ${MAX_REQUEST_QUERY_LENGTH} characters`);
      assertValue(
        await allowRequest(`songrequest:${user.id}`, SONG_REQUESTS_PER_MINUTE, 60),
        'You are sending requests too quickly. Try again in a minute.'
      );

      const request = await votingService.submitSongRequest(roomId, {
        userId: user.id,
        userName: user.displayName,
        query: text
      });

      socket.emit('song_request_submitted', { requestId: request.requestId, message: 'Request sent to the host' });
      await broadcastPendingRequests(roomId);
    }, 'Failed to submit song request');

    on('get_song_requests', async ({ roomId }) => {
      await assertHost(roomId);
      socket.emit('song_requests_updated', await votingService.getPendingSongRequests(roomId));
    }, 'Failed to fetch song requests');

    on('approve_song_request', async ({ roomId, requestId }) => {
      await assertHost(roomId);
      assertValue(requestId, 'Request ID is required');

      let approved;
      try {
        approved = await votingService.approveSongRequest(roomId, requestId);
      } catch (error) {
        // Not found / already processed / no Spotify match are all user-facing outcomes.
        throw new ClientError(error.message);
      }

      await broadcastLeaderboard(roomId);
      await broadcastPendingRequests(roomId);

      const outcome = { requestId, status: 'approved', songTitle: approved.songData.title };
      socket.emit('song_request_processed', outcome);
      if (approved.requesterId && approved.requesterId !== user.id) {
        io.to(userChannel(approved.requesterId)).emit('song_request_processed', outcome);
      }
    }, 'Failed to approve song request');

    on('reject_song_request', async ({ roomId, requestId }) => {
      await assertHost(roomId);
      assertValue(requestId, 'Request ID is required');

      let rejected;
      try {
        rejected = await votingService.rejectSongRequest(roomId, requestId);
      } catch (error) {
        throw new ClientError(error.message);
      }

      await broadcastPendingRequests(roomId);

      const outcome = { requestId, status: 'rejected' };
      socket.emit('song_request_processed', outcome);
      if (rejected.requesterId && rejected.requesterId !== user.id) {
        io.to(userChannel(rejected.requesterId)).emit('song_request_processed', outcome);
      }
    }, 'Failed to reject song request');

    socket.on('leave_room', (roomId) => {
      if (typeof roomId !== 'string') return;
      socket.leave(roomId);
      socket.leave(hostChannel(roomId));
    });
  });
};
