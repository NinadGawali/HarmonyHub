import { useEffect } from 'react';
import { socket } from '../socket/socket';

// Joins `roomId` over the shared socket and re-joins after every reconnect,
// since the server forgets room membership when a connection drops.
export default function useSocket(roomId, onLeaderboardUpdate, userId = null) {
  useEffect(() => {
    if (!roomId) return undefined;

    const join = () => socket.emit('join_room', { roomId, userId });

    // If not connected yet, the 'connect' handler performs the first join.
    if (socket.connected) {
      join();
    }
    socket.on('connect', join);

    if (onLeaderboardUpdate) {
      socket.on('leaderboard_update', onLeaderboardUpdate);
    }

    return () => {
      socket.emit('leave_room', roomId);
      socket.off('connect', join);
      if (onLeaderboardUpdate) {
        socket.off('leaderboard_update', onLeaderboardUpdate);
      }
    };
  }, [roomId, userId, onLeaderboardUpdate]);

  return socket;
}
