const isValidCoordinate = (value, min, max) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

let latestLocation = null;

const receiveLocation = (req, res) => {
  const { latitude, longitude, accuracy, timestamp, source } = req.body;

  if (!isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
    return res.status(400).json({
      error: 'Invalid location coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.'
    });
  }

  const normalizedPayload = {
    latitude,
    longitude,
    accuracy: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null,
    timestamp: timestamp || new Date().toISOString(),
    source: source || 'browser-geolocation'
  };

  latestLocation = normalizedPayload;

  // For now, location is accepted and logged. Replace with DB persistence if needed.
  console.log('📍 Location update received:', normalizedPayload);

  return res.status(200).json({
    success: true,
    message: 'Location received',
    location: normalizedPayload
  });
};

const getLatestLocation = (req, res) => {
  if (!latestLocation) {
    return res.status(404).json({
      error: 'No location has been captured yet.'
    });
  }

  return res.status(200).json({
    success: true,
    location: latestLocation
  });
};

module.exports = {
  receiveLocation,
  getLatestLocation
};
