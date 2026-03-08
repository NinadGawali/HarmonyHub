import { useEffect } from 'react';
import { socket } from '../socket/socket';

export default function useSocket(roomId, onLeaderboardUpdate) {
  useEffect(() => {
    if (!roomId) return;

    // Join the room
    socket.emit('join_room', roomId);

    // Listen for leaderboard updates
    if (onLeaderboardUpdate) {
      socket.on('leaderboard_update', onLeaderboardUpdate);
    }

    // Cleanup on unmount
    return () => {
      socket.emit('leave_room', roomId);
      if (onLeaderboardUpdate) {
        socket.off('leaderboard_update', onLeaderboardUpdate);
      }
    };
  }, [roomId, onLeaderboardUpdate]);

  return socket;
}
