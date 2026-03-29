import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { spotifyAuthApi } from '../spotify/api';
import {
  getSpotifyRedirectUri,
  buildSpotifyAuthFromTokenResponse,
  loadSpotifyAuth,
  persistSpotifyAuth,
  loadOAuthState,
  clearOAuthState
} from '../spotify/authStorage';

export default function SpotifyCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const authCode = searchParams.get('code');
      const authState = searchParams.get('state');
      const authError = searchParams.get('error');

      // Load state from localStorage (survives redirects better than sessionStorage)
      const { state: expectedState, returnPath: storedReturnPath } = loadOAuthState();
      const returnPath = storedReturnPath || '/';

      if (authError) {
        setError(`Spotify login failed: ${authError}`);
        clearOAuthState();
        return;
      }

      if (!authCode) {
        setError('Spotify did not return an authorization code.');
        clearOAuthState();
        return;
      }

      if (!expectedState || authState !== expectedState) {
        console.error('State mismatch:', { expected: expectedState, received: authState });
        setError('Spotify OAuth state validation failed. Please retry login.');
        clearOAuthState();
        return;
      }

      try {
        const redirectUri = getSpotifyRedirectUri();
        const tokenResponse = await spotifyAuthApi.exchangeCodeForToken({
          code: authCode,
          redirectUri
        });

        const existingAuth = loadSpotifyAuth();
        const nextAuth = buildSpotifyAuthFromTokenResponse(
          tokenResponse,
          existingAuth?.refreshToken || null
        );

        persistSpotifyAuth(nextAuth);
        clearOAuthState();

        navigate(returnPath, {
          replace: true,
          state: {
            spotifyLinked: true
          }
        });
      } catch (tokenError) {
        console.error('Spotify callback token exchange failed:', tokenError);
        setError('Failed to complete Spotify login. Please try again.');
        clearOAuthState();
      }
    };

    handleOAuthCallback();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="error-container">
        <h2>Spotify Connection Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Connecting your Spotify account...</p>
    </div>
  );
}