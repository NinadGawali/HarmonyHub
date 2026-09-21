const { config } = require('../config/env');
const { createSession, destroySession } = require('../auth/sessionStore');
const { setSessionCookie, clearSessionCookie } = require('../auth/cookies');
const { isEncryptionConfigured } = require('../auth/tokenCrypto');
const spotifyAuthService = require('../services/spotifyAuthService');
const userService = require('../services/userService');
const { allowRequest } = require('../utils/rateLimit');

const startSession = async (req, res, user) => {
  // Rotate the session id on every login to prevent session fixation.
  await destroySession(req.sessionId);
  const { sessionId, ttlSeconds } = await createSession({ userId: user.id, isGuest: user.isGuest });
  setSessionCookie(res, sessionId, ttlSeconds);
};

const loginRedirect = (res, errorMessage) => {
  const url = new URL('/login', config.frontendUrl);
  url.searchParams.set('error', errorMessage);
  res.redirect(url.toString());
};

// GET /api/auth/spotify/login?returnTo=/path
const spotifyLogin = async (req, res, next) => {
  try {
    if (!isEncryptionConfigured()) {
      return loginRedirect(res, 'Spotify login is not configured on the server (TOKEN_ENCRYPTION_KEY).');
    }
    const authorizeUrl = await spotifyAuthService.beginLogin(req.query.returnTo);
    return res.redirect(authorizeUrl);
  } catch (error) {
    return next(error);
  }
};

// GET /api/auth/spotify/callback?code&state (Spotify redirects the browser here)
const spotifyCallback = async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return loginRedirect(res, error === 'access_denied' ? 'Spotify login was cancelled.' : `Spotify error: ${error}`);
  }
  if (!code) {
    return loginRedirect(res, 'Spotify did not return an authorization code.');
  }

  try {
    const { tokens, returnTo } = await spotifyAuthService.completeLogin({ code, state });
    const profile = await spotifyAuthService.fetchProfile(tokens.access_token);
    const user = await userService.upsertSpotifyUser(profile, tokens);

    await startSession(req, res, user);
    return res.redirect(new URL(returnTo, config.frontendUrl).toString());
  } catch (loginError) {
    if (loginError instanceof spotifyAuthService.OAuthStateError) {
      return loginRedirect(res, loginError.message);
    }

    const spotifyMessage = loginError.response?.data?.error_description || loginError.response?.data?.error;
    console.error('Spotify login failed:', spotifyMessage || loginError.message);
    // Spotify answers 403 for accounts missing from a development-mode app's user allowlist.
    const message = loginError.response?.status === 403
      ? 'This Spotify account is not allowed to use this app yet. Ask the app owner to add it in the Spotify dashboard.'
      : 'Spotify login failed. Please try again.';
    return loginRedirect(res, message);
  }
};

// POST /api/auth/guest { displayName }
const joinAsGuest = async (req, res, next) => {
  try {
    if (req.user) {
      // Already signed in (guest or Spotify); keep the existing identity.
      return res.json({ user: userService.toPublicUser(req.user) });
    }

    const displayName = userService.normalizeDisplayName(req.body?.displayName);
    if (!displayName) {
      return res.status(400).json({
        error: `Enter a name between 1 and ${userService.DISPLAY_NAME_MAX_LENGTH} characters.`
      });
    }

    if (!(await allowRequest(`guest:${req.ip}`, config.guestCreationLimitPerHour, 60 * 60))) {
      return res.status(429).json({ error: 'Too many guest sign-ins from this network. Try again later.' });
    }

    const user = await userService.createGuest(displayName);
    await startSession(req, res, user);
    return res.status(201).json({ user: userService.toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
};

// GET /api/auth/me
const me = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not signed in', code: 'UNAUTHENTICATED' });
  }
  return res.json({ user: userService.toPublicUser(req.user) });
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    await destroySession(req.sessionId);
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/spotify/token -> short-lived access token for the Web Playback SDK
const spotifyToken = async (req, res, next) => {
  try {
    const token = await userService.getSpotifyAccessToken(req.user.id);
    res.set('Cache-Control', 'no-store');
    return res.json(token);
  } catch (error) {
    if (error instanceof userService.SpotifyReauthRequiredError) {
      return res.status(401).json({ error: error.message, code: 'SPOTIFY_LOGIN_REQUIRED' });
    }
    return next(error);
  }
};

module.exports = { spotifyLogin, spotifyCallback, joinAsGuest, me, logout, spotifyToken };
