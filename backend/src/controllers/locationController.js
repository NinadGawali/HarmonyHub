const { prisma } = require('../config/db');

const isValidCoordinate = (value, min, max) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const optionalText = (value) => (value ? String(value).trim().slice(0, 120) : null);

const toResponse = (location) => ({
  latitude: location.latitude,
  longitude: location.longitude,
  accuracy: location.accuracy,
  city: location.city || '',
  state: location.state || '',
  timestamp: location.updatedAt.toISOString()
});

// Save the signed-in user's latest location (one row per user)
const receiveLocation = async (req, res) => {
  const { latitude, longitude, accuracy, city, state } = req.body || {};

  if (!isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
    return res.status(400).json({
      error: 'Invalid location coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.'
    });
  }

  try {
    const data = {
      latitude,
      longitude,
      accuracy: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null,
      city: optionalText(city),
      state: optionalText(state)
    };

    const location = await prisma.userLocation.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...data },
      update: data
    });

    return res.status(200).json({ success: true, location: toResponse(location) });
  } catch (error) {
    console.error('Error saving location:', error);
    return res.status(500).json({ error: 'Failed to save location' });
  }
};

// Return the signed-in user's latest location
const getLatestLocation = async (req, res) => {
  try {
    const location = await prisma.userLocation.findUnique({ where: { userId: req.user.id } });

    if (!location) {
      return res.status(404).json({ error: 'No location has been captured yet.' });
    }

    return res.status(200).json({ success: true, location: toResponse(location) });
  } catch (error) {
    console.error('Error reading location:', error);
    return res.status(500).json({ error: 'Failed to read location' });
  }
};

module.exports = {
  receiveLocation,
  getLatestLocation
};
