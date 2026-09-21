const { readSessionId } = require('../auth/cookies');
const { getSession } = require('../auth/sessionStore');
const { getUserById } = require('../services/userService');

// Socket.IO middleware: only connections with a valid session cookie are accepted.
// The session's user becomes the socket's identity (socket.data.user).
const authenticateSocket = async (socket, next) => {
  try {
    const session = await getSession(readSessionId(socket.handshake.headers.cookie));
    const user = session ? await getUserById(session.userId) : null;

    if (!user) {
      const error = new Error('Not signed in');
      error.data = { code: 'UNAUTHENTICATED' };
      return next(error);
    }

    socket.data.user = user;
    return next();
  } catch (error) {
    console.error('Socket authentication failed:', error);
    return next(new Error('Authentication unavailable'));
  }
};

module.exports = { authenticateSocket };
