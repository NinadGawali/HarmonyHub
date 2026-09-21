import { io } from 'socket.io-client';

// Same-origin connection (proxied to the backend); the session cookie authenticates it.
// Connected on demand by useSocket once the user has a session.
export const socket = io({
  autoConnect: false,
  withCredentials: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10
});

export default socket;
