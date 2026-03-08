const redis = require('../config/redis');
const { generateRoomCode } = require('../utils/generateRoomCode');

// Create a new room
const createRoom = async (req, res) => {
  try {
    const { adminName } = req.body;

    if (!adminName || adminName.trim() === '') {
      return res.status(400).json({ error: 'Admin name is required' });
    }

    const roomId = generateRoomCode();

    // Store room data
    await redis.hSet(`room:${roomId}`, {
      adminName: adminName.trim(),
      createdAt: new Date().toISOString(),
      active: 'true'
    });

    // Set room expiry to 24 hours
    await redis.expire(`room:${roomId}`, 86400);

    res.status(201).json({
      roomId,
      adminName: adminName.trim(),
      message: 'Room created successfully'
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
};

// Get room details
const getRoomDetails = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const roomData = await redis.hGetAll(`room:${roomId}`);

    if (!roomData || Object.keys(roomData).length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Get user count
    const userCount = await redis.sCard(`roomUsers:${roomId}`) || 0;

    res.json({
      roomId,
      ...roomData,
      userCount
    });
  } catch (error) {
    console.error('Error getting room details:', error);
    res.status(500).json({ error: 'Failed to get room details' });
  }
};

// Join room
const joinRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userName } = req.body;

    if (!userName || userName.trim() === '') {
      return res.status(400).json({ error: 'User name is required' });
    }

    // Check if room exists
    const roomExists = await redis.exists(`room:${roomId}`);
    
    if (!roomExists) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Add user to room
    const userId = `${userName.trim()}_${Date.now()}`;
    await redis.sAdd(`roomUsers:${roomId}`, userId);

    res.json({
      message: 'Joined room successfully',
      roomId,
      userId,
      userName: userName.trim()
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
};

// Delete room
const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Delete all room-related keys
    await redis.del(`room:${roomId}`);
    await redis.del(`leaderboard:${roomId}`);
    await redis.del(`roomUsers:${roomId}`);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
};

module.exports = {
  createRoom,
  getRoomDetails,
  joinRoom,
  deleteRoom
};
