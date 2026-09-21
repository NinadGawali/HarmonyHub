const { redis } = require('../config/redis');
const { config } = require('../config/env');
const { generateRoomCode } = require('../utils/generateRoomCode');
const votingService = require('../services/votingService');

const MAX_CODE_ATTEMPTS = 5;

// Create a new room hosted by the signed-in Spotify user
const createRoom = async (req, res) => {
  try {
    let roomId = null;

    // HSETNX claims a code atomically, so the code of a live room is never reused.
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !roomId; attempt += 1) {
      const candidate = generateRoomCode();
      if (await redis.hSetNX(`room:${candidate}`, 'hostUserId', req.user.id)) {
        roomId = candidate;
      }
    }

    if (!roomId) {
      return res.status(503).json({ error: 'Could not allocate a room code. Please try again.' });
    }

    await redis.hSet(`room:${roomId}`, {
      adminName: req.user.displayName,
      createdAt: new Date().toISOString(),
      active: 'true',
      votingOpen: 'true'
    });
    await redis.expire(`room:${roomId}`, config.roomTtlSeconds);

    return res.status(201).json({
      roomId,
      adminName: req.user.displayName,
      message: 'Room created successfully'
    });
  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({ error: 'Failed to create room' });
  }
};

// Get room details
const getRoomDetails = async (req, res) => {
  try {
    const { roomId } = req.params;
    const roomData = await redis.hGetAll(`room:${roomId}`);

    if (!roomData || Object.keys(roomData).length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const userCount = await redis.sCard(`roomUsers:${roomId}`);
    const { hostUserId, ...publicRoomData } = roomData;

    return res.json({
      roomId,
      ...publicRoomData,
      votingOpen: roomData.votingOpen !== 'false',
      userCount,
      isHost: hostUserId === req.user.id
    });
  } catch (error) {
    console.error('Error getting room details:', error);
    return res.status(500).json({ error: 'Failed to get room details' });
  }
};

// Join a room as the signed-in user (guest or Spotify)
const joinRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!(await votingService.roomExists(roomId))) {
      return res.status(404).json({ error: 'Room not found' });
    }

    await votingService.addRoomMember(roomId, req.user.id);

    return res.json({
      message: 'Joined room successfully',
      roomId,
      userId: req.user.id,
      userName: req.user.displayName
    });
  } catch (error) {
    console.error('Error joining room:', error);
    return res.status(500).json({ error: 'Failed to join room' });
  }
};

// Delete a room (host only)
const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!(await votingService.isRoomHost(roomId, req.user.id))) {
      return res.status(403).json({ error: 'Only the host can delete this room' });
    }

    await votingService.deleteRoomData(roomId);
    return res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    return res.status(500).json({ error: 'Failed to delete room' });
  }
};

module.exports = {
  createRoom,
  getRoomDetails,
  joinRoom,
  deleteRoom
};
