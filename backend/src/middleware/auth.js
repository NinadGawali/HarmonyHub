const { readSessionId, setSessionCookie } = require('../auth/cookies');
const { getSession, ttlFor } = require('../auth/sessionStore');
const { getUserById } = require('../services/userService');

// Resolves the session cookie to a user. Never rejects the request by itself.
const loadSession = async (req, res, next) => {
  try {
    const sessionId = readSessionId(req.headers.cookie);
    const session = await getSession(sessionId);

    if (session) {
      const user = await getUserById(session.userId);
      if (user) {
        req.user = user;
        req.sessionId = sessionId;
        // Keep the cookie lifetime in step with the sliding server-side session.
        setSessionCookie(res, sessionId, ttlFor(user.isGuest));
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

const requireSession = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Join as a guest or log in with Spotify first.', code: 'UNAUTHENTICATED' });
  }
  return next();
};

const requireSpotifyUser = (req, res, next) => {
  if (!req.user || req.user.isGuest) {
    return res.status(401).json({ error: 'Log in with Spotify to continue.', code: 'SPOTIFY_LOGIN_REQUIRED' });
  }
  return next();
};

module.exports = { loadSession, requireSession, requireSpotifyUser };
