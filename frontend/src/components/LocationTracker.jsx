import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, AlertTriangle, Ban } from 'lucide-react';
import { locationAPI } from '../api/api';

export default function LocationTracker() {
  const watchIdRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('Location permission not requested yet.');

  const sendLocationToBackend = useCallback(async (coords) => {
    try {
      await locationAPI.send({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        timestamp: new Date().toISOString(),
        source: 'browser-geolocation'
      });
    } catch (error) {
      console.error('Failed to send location to backend:', error);
    }
  }, []);

  const handleSuccess = useCallback(
    (position) => {
      const latestLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp).toISOString()
      };

      setLocation(latestLocation);
      setStatus('granted');
      setMessage('Location tracking active.');
      sendLocationToBackend(latestLocation);
    },
    [sendLocationToBackend]
  );

  const handleError = useCallback((error) => {
    if (error.code === error.PERMISSION_DENIED) {
      setStatus('denied');
      setMessage('Location permission denied. Please allow it in browser settings.');
      return;
    }

    if (error.code === error.POSITION_UNAVAILABLE) {
      setStatus('error');
      setMessage('Location unavailable. Please check GPS/network and try again.');
      return;
    }

    if (error.code === error.TIMEOUT) {
      setStatus('error');
      setMessage('Location request timed out.');
      return;
    }

    setStatus('error');
    setMessage('Failed to retrieve location.');
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      setMessage('Geolocation is not supported by this browser.');
      return;
    }

    setStatus('requesting');
    setMessage('Requesting location permission...');

    stopTracking();

    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    });
  }, [handleError, handleSuccess, stopTracking]);

  useEffect(() => {
    startTracking();

    return () => {
      stopTracking();
    };
  }, [startTracking, stopTracking]);

  const getStatusIcon = () => {
    if (status === 'denied') return <Ban size={16} />;
    if (status === 'error' || status === 'unsupported') return <AlertTriangle size={16} />;
    if (status === 'granted') return <Navigation size={16} />;
    return <MapPin size={16} />;
  };

  return (
    <div className="location-tracker" role="status" aria-live="polite">
      <div className={`location-status location-status-${status}`}>
        <span className="location-icon">{getStatusIcon()}</span>
        <span>{message}</span>
        {(status === 'denied' || status === 'error' || status === 'unsupported') && (
          <button className="location-retry" onClick={startTracking} type="button">
            Retry
          </button>
        )}
      </div>

      {location && (
        <div className="location-data">
          <span>Lat: {location.latitude.toFixed(6)}</span>
          <span>Lng: {location.longitude.toFixed(6)}</span>
          <span>Accuracy: {Math.round(location.accuracy || 0)}m</span>
        </div>
      )}
    </div>
  );
}
