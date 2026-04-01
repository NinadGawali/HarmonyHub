import { useCallback, useEffect, useRef, useState } from 'react';
import { SpotifyApiError, spotifyAuthApi, spotifyPlaybackApi } from '../api';
import { createSpotifyPlayer, destroySpotifyPlayer } from '../player';
import {
  getSpotifyRedirectUri,
  SPOTIFY_OAUTH_RETURN_PATH_KEY,
  SPOTIFY_OAUTH_STATE_KEY,
  buildSpotifyAuthFromTokenResponse,
  clearSpotifyAuth,
  loadSpotifyAuth,
  persistSpotifyAuth
} from '../authStorage';

function buildOAuthState() {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizePlayerState(state) {
  if (!state) {
    return null;
  }

  const currentTrack = state.track_window?.current_track;
  return {
    isPaused: state.paused,
    positionMs: state.position,
    durationMs: state.duration,
    trackUri: currentTrack?.uri || null,
    trackName: currentTrack?.name || '',
    artistName: currentTrack?.artists?.map((artist) => artist.name).join(', ') || ''
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function useSpotifyPlayer(options = {}) {
  const playerName = options.playerName || 'HarmonyHub Player';

  const [auth, setAuth] = useState(() => loadSpotifyAuth());
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [playbackState, setPlaybackState] = useState(null);

  const authRef = useRef(auth);
  const playerRef = useRef(player);
  const deviceIdRef = useRef(deviceId);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  const waitForDeviceId = useCallback(async (timeoutMs = 7000) => {
    if (deviceIdRef.current) {
      return deviceIdRef.current;
    }

    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (deviceIdRef.current) {
        return deviceIdRef.current;
      }
    }

    throw new Error('Spotify device is not ready yet');
  }, []);

  const updateAuth = useCallback((nextAuth) => {
    if (nextAuth) {
      persistSpotifyAuth(nextAuth);
      setAuth(nextAuth);
      return;
    }

    clearSpotifyAuth();
    setAuth(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const currentAuth = authRef.current;
    if (!currentAuth?.refreshToken) {
      throw new Error('Spotify session expired. Please reconnect Spotify.');
    }

    const refreshed = await spotifyAuthApi.refreshAccessToken(currentAuth.refreshToken);
    const nextAuth = buildSpotifyAuthFromTokenResponse(refreshed, currentAuth.refreshToken);
    updateAuth(nextAuth);
    return nextAuth.accessToken;
  }, [updateAuth]);

  const getValidAccessToken = useCallback(async () => {
    const currentAuth = authRef.current;
    if (!currentAuth?.accessToken) {
      return null;
    }

    const hasExpired = Date.now() >= Number(currentAuth.expiresAt || 0) - 30000;
    if (!hasExpired) {
      return currentAuth.accessToken;
    }

    if (!currentAuth.refreshToken) {
      updateAuth(null);
      return null;
    }

    return refreshSession();
  }, [refreshSession, updateAuth]);

  const withTokenRetry = useCallback(async (operation) => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      throw new Error('Spotify is not connected.');
    }

    try {
      return await operation(accessToken);
    } catch (operationError) {
      if (operationError instanceof SpotifyApiError && operationError.status === 401) {
        const refreshedToken = await refreshSession();
        return operation(refreshedToken);
      }
      throw operationError;
    }
  }, [getValidAccessToken, refreshSession]);

  const withTransientRetries = useCallback(async (operation, maxAttempts = 4) => {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const status = error?.status;
        const shouldRetry = status === 404 || status === 429 || status === 502 || status === 503;

        if (!shouldRetry || attempt === maxAttempts) {
          throw error;
        }

        await sleep(250 * attempt);
      }
    }

    throw lastError || new Error('Spotify operation failed');
  }, []);

  const waitForDeviceVisibility = useCallback(async (targetDeviceId, timeoutMs = 8000) => {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const devicesResponse = await withTokenRetry((accessToken) =>
        spotifyPlaybackApi.getDevices({ accessToken })
      );

      const devices = devicesResponse?.devices || [];
      const matched = devices.find((device) => device.id === targetDeviceId);

      if (matched) {
        return matched;
      }

      await sleep(250);
    }

    throw new Error('Spotify device did not appear in available devices yet');
  }, [withTokenRetry]);

  const startLogin = useCallback(async (returnPath = window.location.pathname) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('You are offline. Reconnect to the internet before connecting Spotify.');
    }

    const redirectUri = getSpotifyRedirectUri();
    const state = buildOAuthState();

    // Import saveOAuthState dynamically to avoid circular dependency
    const { saveOAuthState } = await import('../authStorage');
    saveOAuthState(state, returnPath);

    const response = await spotifyAuthApi.getLoginUrl({
      redirectUri,
      state
    });

    window.location.assign(response.url);
  }, []);

  const initializePlayer = useCallback(async () => {
    if (playerRef.current) {
      return playerRef.current;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('You are offline. Reconnect to the internet before starting the Spotify player.');
    }

    const token = await getValidAccessToken();
    if (!token) {
      throw new Error('Spotify authentication required');
    }

    setStatus('connecting');
    setError('');

    try {
      const createdPlayer = await createSpotifyPlayer({
        name: playerName,
        getOAuthToken: async (callback) => {
          try {
            const latestToken = await getValidAccessToken();
            callback(latestToken || '');
          } catch (tokenError) {
            console.error('Failed to provide Spotify token to SDK:', tokenError);
            callback('');
          }
        },
        onReady: ({ device_id }) => {
          deviceIdRef.current = device_id;
          setDeviceId(device_id);
          setPlayerReady(true);
          setStatus('ready');
        },
        onNotReady: () => {
          setPlayerReady(false);
          setStatus('not_ready');
        },
        onStateChange: (state) => {
          const normalized = normalizePlayerState(state);
          if (normalized) {
            setPlaybackState(normalized);
          }
        },
        onInitializationError: ({ message }) => {
          setStatus('error');
          setError(message || 'Spotify player initialization failed');
        },
        onAuthenticationError: ({ message }) => {
          setStatus('error');
          setError(message || 'Spotify authentication failed');
        },
        onAccountError: ({ message }) => {
          setStatus('error');
          setError(message || 'Spotify Premium is required for Web Playback SDK');
        },
        onPlaybackError: ({ message }) => {
          setError(message || 'Spotify playback error');
        }
      });

      setPlayer(createdPlayer);
      return createdPlayer;
    } catch (initError) {
      setStatus('error');
      setError(initError.message || 'Failed to initialize Spotify player');
      throw initError;
    }
  }, [getValidAccessToken, playerName]);

  const disconnectPlayer = useCallback(async () => {
    await destroySpotifyPlayer(playerRef.current);
    setPlayer(null);
    setDeviceId(null);
    deviceIdRef.current = null;
    setPlayerReady(false);
    setStatus('idle');
  }, []);

  const transferPlaybackHere = useCallback(async (play = false) => {
    const resolvedDeviceId = await waitForDeviceId();

    await waitForDeviceVisibility(resolvedDeviceId);

    return withTransientRetries(() =>
      withTokenRetry((accessToken) =>
        spotifyPlaybackApi.transferPlayback({
          accessToken,
          deviceId: resolvedDeviceId,
          play
        })
      )
    );
  }, [waitForDeviceId, waitForDeviceVisibility, withTokenRetry, withTransientRetries]);

  const playTrack = useCallback(async (trackUri, positionMs = 0) => {
    if (!trackUri) {
      throw new Error('Track URI is required');
    }

    const resolvedDeviceId = await waitForDeviceId();

    try {
      await withTokenRetry((accessToken) =>
        spotifyPlaybackApi.playTrack({
          accessToken,
          deviceId: resolvedDeviceId,
          trackUri,
          positionMs
        })
      );
    } catch (playError) {
      if (playError instanceof SpotifyApiError && (playError.status === 404 || playError.status === 403)) {
        await transferPlaybackHere(false);
        await withTransientRetries(() =>
          withTokenRetry((accessToken) =>
            spotifyPlaybackApi.playTrack({
              accessToken,
              deviceId: resolvedDeviceId,
              trackUri,
              positionMs
            })
          )
        );
      } else {
        throw playError;
      }
    }
  }, [transferPlaybackHere, waitForDeviceId, withTokenRetry, withTransientRetries]);

  const pausePlayback = useCallback(async () => {
    const resolvedDeviceId = await waitForDeviceId();

    return withTokenRetry((accessToken) =>
      spotifyPlaybackApi.pausePlayback({
        accessToken,
        deviceId: resolvedDeviceId
      })
    );
  }, [waitForDeviceId, withTokenRetry]);

  const resumePlayback = useCallback(async () => {
    const resolvedDeviceId = await waitForDeviceId();

    return withTokenRetry((accessToken) =>
      spotifyPlaybackApi.resumePlayback({
        accessToken,
        deviceId: resolvedDeviceId
      })
    );
  }, [waitForDeviceId, withTokenRetry]);

  const seekTo = useCallback(async (positionMs) => {
    const resolvedDeviceId = await waitForDeviceId();

    return withTokenRetry((accessToken) =>
      spotifyPlaybackApi.seekTo({
        accessToken,
        positionMs,
        deviceId: resolvedDeviceId
      })
    );
  }, [waitForDeviceId, withTokenRetry]);

  const logout = useCallback(async () => {
    await disconnectPlayer();
    updateAuth(null);
    setPlaybackState(null);
    setError('');
  }, [disconnectPlayer, updateAuth]);

  useEffect(() => {
    return () => {
      destroySpotifyPlayer(playerRef.current);
    };
  }, []);

  return {
    isAuthenticated: Boolean(auth?.accessToken),
    accessToken: auth?.accessToken || null,
    auth,
    player,
    deviceId,
    playerReady,
    status,
    error,
    playbackState,
    startLogin,
    initializePlayer,
    transferPlaybackHere,
    playTrack,
    pausePlayback,
    resumePlayback,
    seekTo,
    refreshSession,
    disconnectPlayer,
    logout
  };
}