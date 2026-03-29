export const SPOTIFY_AUTH_STORAGE_KEY = 'harmonyhub.spotify.auth';
export const SPOTIFY_OAUTH_STATE_KEY = 'harmonyhub.spotify.oauth.state';
export const SPOTIFY_OAUTH_RETURN_PATH_KEY = 'harmonyhub.spotify.oauth.returnPath';
export const SPOTIFY_CALLBACK_PATH = '/spotify/callback';

export function getSpotifyRedirectUri() {
  const configuredRedirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

  if (configuredRedirectUri && configuredRedirectUri.trim()) {
    return configuredRedirectUri.trim();
  }

  return `${window.location.origin}${SPOTIFY_CALLBACK_PATH}`;
}

export function loadSpotifyAuth() {
  try {
    const raw = localStorage.getItem(SPOTIFY_AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to parse Spotify auth state:', error);
    return null;
  }
}

export function persistSpotifyAuth(authState) {
  localStorage.setItem(SPOTIFY_AUTH_STORAGE_KEY, JSON.stringify(authState));
}

export function clearSpotifyAuth() {
  localStorage.removeItem(SPOTIFY_AUTH_STORAGE_KEY);
}

export function buildSpotifyAuthFromTokenResponse(tokenData, existingRefreshToken = null) {
  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || existingRefreshToken || null,
    tokenType: tokenData.token_type || 'Bearer',
    scope: tokenData.scope || '',
    expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000,
    updatedAt: Date.now()
  };
}

export function saveOAuthState(state, returnPath) {
  // Use localStorage for OAuth state since it persists across Spotify redirects better than sessionStorage.
  // This is critical when using IP addresses instead of localhost.
  localStorage.setItem(SPOTIFY_OAUTH_STATE_KEY, state);
  localStorage.setItem(SPOTIFY_OAUTH_RETURN_PATH_KEY, returnPath);
}

export function loadOAuthState() {
  // Try localStorage first (survives redirects on IP addresses)
  const state = localStorage.getItem(SPOTIFY_OAUTH_STATE_KEY);
  const returnPath = localStorage.getItem(SPOTIFY_OAUTH_RETURN_PATH_KEY);
  return { state, returnPath };
}

export function clearOAuthState() {
  localStorage.removeItem(SPOTIFY_OAUTH_STATE_KEY);
  localStorage.removeItem(SPOTIFY_OAUTH_RETURN_PATH_KEY);
}