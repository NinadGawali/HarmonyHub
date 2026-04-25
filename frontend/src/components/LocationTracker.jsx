import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, AlertTriangle, Ban } from 'lucide-react';
import { locationAPI } from '../api/api';

const LOCATION_STORAGE_KEY = 'harmonyhub.location.v1';

export default function LocationTracker() {
  const hasCapturedOnceRef = useRef(false);
  const lastResolvedKeyRef = useRef('');
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('Location permission not requested yet.');

  const resolveCityState = useCallback(async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
      );

      if (!response.ok) {
        return { city: '', state: '' };
      }

      const payload = await response.json();
      const address = payload?.address || {};

      return {
        city: address.city || address.town || address.village || address.municipality || '',
        state: address.state || address.region || ''
      };
    } catch (_error) {
      return { city: '', state: '' };
    }
  }, []);

  const sendLocationToBackend = useCallback(async (coords) => {
    try {
      await locationAPI.send({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        city: coords.city,
        state: coords.state,
        timestamp: new Date().toISOString(),
        source: 'browser-geolocation'
      });
    } catch (error) {
      console.error('Failed to send location to backend:', error);
    }
  }, []);

  const handleSuccess = useCallback(async (position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const approximateKey = `${latitude.toFixed(2)}:${longitude.toFixed(2)}`;

    let cityState = { city: '', state: '' };
    if (lastResolvedKeyRef.current !== approximateKey) {
      cityState = await resolveCityState(latitude, longitude);
      lastResolvedKeyRef.current = approximateKey;
    } else if (location) {
      cityState = { city: location.city || '', state: location.state || '' };
    }

    const latestLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      city: cityState.city,
      state: cityState.state,
      timestamp: new Date(position.timestamp).toISOString()
    };

    try {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(latestLocation));
    } catch (_error) {
      // Ignore storage failures and continue with in-memory state.
    }

    setLocation(latestLocation);
    setStatus('granted');
    setMessage('Location captured and saved.');
    sendLocationToBackend(latestLocation);
  }, [location, resolveCityState, sendLocationToBackend]);

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

  const captureLocationOnce = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      setMessage('Geolocation is not supported by this browser.');
      return;
    }

    setStatus('requesting');
    setMessage('Requesting location permission...');

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000
    });
  }, [handleError, handleSuccess]);

  useEffect(() => {
    if (hasCapturedOnceRef.current) {
      return;
    }

    hasCapturedOnceRef.current = true;

    try {
      const cachedRaw = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (cachedRaw) {
        const cachedLocation = JSON.parse(cachedRaw);
        if (cachedLocation && cachedLocation.state) {
          setLocation(cachedLocation);
          setStatus('granted');
          setMessage('Using saved location.');
          sendLocationToBackend(cachedLocation);
          return;
        }
      }
    } catch (_error) {
      // Continue to fresh capture if cache is invalid.
    }

    captureLocationOnce();
  }, [captureLocationOnce, sendLocationToBackend]);

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
          <button className="location-retry" onClick={captureLocationOnce} type="button">
            Retry
          </button>
        )}
      </div>

      {location && (
        <div className="location-data">
          {(location.city || location.state) && <span>{[location.city, location.state].filter(Boolean).join(', ')}</span>}
          <span>Lat: {location.latitude.toFixed(4)}</span>
          <span>Lng: {location.longitude.toFixed(4)}</span>
          <span>Accuracy: {Math.round(location.accuracy || 0)}m</span>
        </div>
      )}
    </div>
  );
}
