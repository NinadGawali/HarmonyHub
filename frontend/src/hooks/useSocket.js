import { useEffect } from 'react';
import { socket } from '../socket/socket';

// Joins `roomId` over the shared, session-authenticated socket. Pass enabled=false until the
// user has a session. Re-joins after every reconnect, since the server forgets room membership
// when a connection drops.
export default function useSocket(roomId, onLeaderboardUpdate, enabled = true) {
  useEffect(() => {
    if (!roomId || !enabled) return undefined;

    const join = () => socket.emit('join_room', { roomId });

    socket.on('connect', join);
    if (onLeaderboardUpdate) {
      socket.on('leaderboard_update', onLeaderboardUpdate);
    }

    if (socket.connected) {
      join();
    } else {
      socket.connect();
    }

    return () => {
      socket.emit('leave_room', roomId);
      socket.off('connect', join);
      if (onLeaderboardUpdate) {
        socket.off('leaderboard_update', onLeaderboardUpdate);
      }
    };
  }, [roomId, enabled, onLeaderboardUpdate]);

  return socket;
}
