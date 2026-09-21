const redis = require('../config/redis');
const { searchSongs, getTrackDetails } = require('./spotifyService');

class VoteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VoteError';
    this.code = code;
  }
}

// Vote for a song (one vote per user per song)
const voteSong = async (roomId, songId, userId) => {
  try {
    // Reject votes for songs that are not in the room; ZINCRBY would otherwise re-add them.
    const currentScore = await redis.zScore(`leaderboard:${roomId}`, songId);
    if (currentScore === null) {
      throw new VoteError('SONG_NOT_FOUND', 'This song is no longer in the room');
    }

    // SADD returns 0 when the member already exists, which makes the duplicate check atomic.
    const added = await redis.sAdd(`votes:${roomId}:${songId}`, userId);
    if (!added) {
      throw new VoteError('ALREADY_VOTED', 'You have already voted for this song');
    }

    await redis.zIncrBy(`leaderboard:${roomId}`, 1, songId);

    // Get updated leaderboard
    const leaderboard = await getLeaderboard(roomId);
    
    return leaderboard;
  } catch (error) {
    if (!(error instanceof VoteError)) {
      console.error('Error voting for song:', error);
    }
    throw error;
  }
};

// Song ids in the room that the user has already voted for
const getUserVotes = async (roomId, userId) => {
  const songIds = await redis.zRange(`leaderboard:${roomId}`, 0, -1);
  if (!songIds.length) {
    return [];
  }

  const membership = await Promise.all(
    songIds.map((songId) => redis.sIsMember(`votes:${roomId}:${songId}`, userId))
  );

  return songIds.filter((_, index) => membership[index]);
};

// Get leaderboard for a room
const getLeaderboard = async (roomId) => {
  try {
    // Get sorted set with scores in descending order
    const results = await redis.zRangeWithScores(
      `leaderboard:${roomId}`,
      0,
      -1
    );

    // Format results - handle empty results
    if (!results || results.length === 0) {
      return [];
    }

    // Reverse for descending order (highest votes first)
    results.reverse();

    const leaderboard = await Promise.all(
      results.map(async (item) => {
        const songData = await redis.hGetAll(`song:${item.value}`);
        return {
          songId: item.value,
          votes: item.score,
          title: songData.title || 'Unknown',
          artist: songData.artist || 'Unknown',
          image: songData.image || '',
          spotifyUrl: songData.spotifyUrl || '',
          previewUrl: songData.previewUrl || ''
        };
      })
    );

    return leaderboard;
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    throw error;
  }
};

// Add song to room
const addSongToRoom = async (roomId, songData) => {
  try {
    const { songId, title, artist, image, spotifyUrl, previewUrl } = songData;

    // Store song metadata
    await redis.hSet(`song:${songId}`, {
      title,
      artist,
      image: image || '',
      spotifyUrl: spotifyUrl || '',
      previewUrl: previewUrl || ''
    });

    // Add to leaderboard with 0 votes
    await redis.zAdd(`leaderboard:${roomId}`, {
      score: 0,
      value: songId
    });

    return true;
  } catch (error) {
    console.error('Error adding song to room:', error);
    throw error;
  }
};

// Remove song from room
const removeSongFromRoom = async (roomId, songId) => {
  try {
    // Drop the voter set too, so a re-added song starts fresh instead of blocking earlier voters.
    await Promise.all([
      redis.zRem(`leaderboard:${roomId}`, songId),
      redis.del(`votes:${roomId}:${songId}`)
    ]);
    return true;
  } catch (error) {
    console.error('Error removing song from room:', error);
    throw error;
  }
};

// Check if user has voted for a song
const hasUserVoted = async (roomId, songId, userId) => {
  try {
    const voteKey = `votes:${roomId}:${songId}`;
    return await redis.sIsMember(voteKey, userId);
  } catch (error) {
    console.error('Error checking vote:', error);
    return false;
  }
};

// Set voting status for a room
const setVotingStatus = async (roomId, isOpen) => {
  try {
    await redis.hSet(`room:${roomId}`, 'votingOpen', isOpen ? 'true' : 'false');
    return true;
  } catch (error) {
    console.error('Error setting voting status:', error);
    throw error;
  }
};

// Get voting status
const getVotingStatus = async (roomId) => {
  try {
    const status = await redis.hGet(`room:${roomId}`, 'votingOpen');
    // Voting is open unless explicitly closed; rooms created before this field existed have no value.
    return status !== 'false';
  } catch (error) {
    console.error('Error getting voting status:', error);
    return true; // Default to open
  }
};

const extractSpotifyTrackId = (input = '') => {
  if (!input) return null;

  const directTrackIdMatch = input.match(/^[A-Za-z0-9]{22}$/);
  if (directTrackIdMatch) {
    return directTrackIdMatch[0];
  }

  const spotifyUrlMatch = input.match(/spotify\.com\/track\/([A-Za-z0-9]{22})/i);
  if (spotifyUrlMatch) {
    return spotifyUrlMatch[1];
  }

  const spotifyUriMatch = input.match(/spotify:track:([A-Za-z0-9]{22})/i);
  if (spotifyUriMatch) {
    return spotifyUriMatch[1];
  }

  return null;
};

const resolveSongFromRequest = async (requestText) => {
  const trackId = extractSpotifyTrackId(requestText);

  if (trackId) {
    return getTrackDetails(trackId);
  }

  const results = await searchSongs(requestText);
  if (!results || results.length === 0) {
    throw new Error('No songs found for this request');
  }

  return results[0];
};

const submitSongRequest = async (roomId, requestData) => {
  try {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const request = {
      requestId,
      roomId,
      userId: requestData.userId,
      userName: requestData.userName || 'Guest',
      query: requestData.query,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    await redis.hSet(`songrequest:${requestId}`, request);
    await redis.rPush(`songrequests:pending:${roomId}`, requestId);

    return request;
  } catch (error) {
    console.error('Error submitting song request:', error);
    throw error;
  }
};

const getPendingSongRequests = async (roomId) => {
  try {
    const requestIds = await redis.lRange(`songrequests:pending:${roomId}`, 0, -1);
    if (!requestIds || requestIds.length === 0) {
      return [];
    }

    const requests = await Promise.all(
      requestIds.map(async (requestId) => redis.hGetAll(`songrequest:${requestId}`))
    );

    return requests.filter((request) => request && request.requestId && request.status === 'pending');
  } catch (error) {
    console.error('Error getting pending song requests:', error);
    throw error;
  }
};

const approveSongRequest = async (roomId, requestId) => {
  try {
    const request = await redis.hGetAll(`songrequest:${requestId}`);
    if (!request || !request.requestId) {
      throw new Error('Song request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Song request already processed');
    }

    const songData = await resolveSongFromRequest(request.query);
    await addSongToRoom(roomId, songData);

    await redis.hSet(`songrequest:${requestId}`, {
      status: 'approved',
      approvedSongId: songData.songId,
      approvedSongTitle: songData.title,
      updatedAt: new Date().toISOString()
    });

    await redis.lRem(`songrequests:pending:${roomId}`, 0, requestId);

    return {
      requestId,
      requesterId: request.userId,
      songData
    };
  } catch (error) {
    console.error('Error approving song request:', error);
    throw error;
  }
};

const rejectSongRequest = async (roomId, requestId) => {
  try {
    const request = await redis.hGetAll(`songrequest:${requestId}`);
    if (!request || !request.requestId) {
      throw new Error('Song request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Song request already processed');
    }

    await redis.hSet(`songrequest:${requestId}`, {
      status: 'rejected',
      updatedAt: new Date().toISOString()
    });

    await redis.lRem(`songrequests:pending:${roomId}`, 0, requestId);

    return {
      requestId,
      requesterId: request.userId
    };
  } catch (error) {
    console.error('Error rejecting song request:', error);
    throw error;
  }
};

module.exports = {
  VoteError,
  voteSong,
  getUserVotes,
  getLeaderboard,
  addSongToRoom,
  removeSongFromRoom,
  hasUserVoted,
  setVotingStatus,
  getVotingStatus,
  submitSongRequest,
  getPendingSongRequests,
  approveSongRequest,
  rejectSongRequest
};
