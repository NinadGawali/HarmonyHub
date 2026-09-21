import { useCallback, useEffect, useState } from 'react';
import { socket } from '../socket/socket';
import { useToast } from '../components/Toast';
import useSocket from './useSocket';

const withItem = (set, item) => new Set(set).add(item);
const withoutItem = (set, item) => {
  const next = new Set(set);
  next.delete(item);
  return next;
};

/**
 * Live room state and actions over the shared socket.
 * Pass `enabled` once the REST join has confirmed the room exists.
 */
export default function useRoomSocket({ roomId, enabled }) {
  const toast = useToast();
  const [songs, setSongs] = useState([]);
  // False until the first leaderboard arrives after joining.
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [votingOpen, setVotingOpen] = useState(true);
  const [votedIds, setVotedIds] = useState(() => new Set());
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [requests, setRequests] = useState([]);
  const [togglingVoting, setTogglingVoting] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [requestState, setRequestState] = useState({ sending: false, message: '' });

  const handleLeaderboard = useCallback((leaderboard) => {
    setSongs(Array.isArray(leaderboard) ? leaderboard : []);
    setLoaded(true);
  }, []);
  useSocket(roomId, handleLeaderboard, enabled);

  useEffect(() => {
    const handlers = {
      connect: () => setConnected(true),
      disconnect: () => setConnected(false),
      voting_status_changed: ({ isOpen }) => {
        setVotingOpen(isOpen);
        setTogglingVoting(false);
      },
      my_votes: ({ songIds }) => setVotedIds(new Set(songIds || [])),
      vote_success: ({ songId }) => {
        setPendingIds((previous) => withoutItem(previous, songId));
        setVotedIds((previous) => withItem(previous, songId));
      },
      vote_rejected: ({ songId, code, message }) => {
        setPendingIds((previous) => withoutItem(previous, songId));
        if (code === 'ALREADY_VOTED') setVotedIds((previous) => withItem(previous, songId));
        toast.error(message || 'Your vote could not be recorded');
      },
      song_requests_updated: (list) => setRequests(Array.isArray(list) ? list : []),
      song_request_submitted: ({ message }) => {
        setRequestState({ sending: false, message: message || 'Request sent to the host' });
      },
      song_request_processed: ({ status, songTitle }) => {
        const approved = status === 'approved';
        const message = approved ? `Approved${songTitle ? `: ${songTitle}` : ''}` : 'Request declined';
        setRequestState((previous) => ({ ...previous, message }));
        if (approved) toast.success(message);
        else toast.info(message);
      },
      error: ({ event, message } = {}) => {
        setTogglingVoting(false);
        setRequestState((previous) => ({ ...previous, sending: false }));
        if (event === 'join_room') {
          setJoinError(message || 'Could not join the room');
          return;
        }
        toast.error(message || 'Something went wrong');
      }
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    return () => Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
  }, [toast]);

  const vote = useCallback((songId) => {
    if (!votingOpen) {
      toast.info('Voting is closed right now');
      return;
    }
    if (!socket.connected) {
      toast.error('You are offline. Reconnecting...');
      return;
    }
    setPendingIds((previous) => withItem(previous, songId));
    socket.emit('vote_song', { roomId, songId });
  }, [roomId, toast, votingOpen]);

  const submitRequest = useCallback((query) => {
    setRequestState({ sending: true, message: '' });
    socket.emit('submit_song_request', { roomId, query });
  }, [roomId]);

  const addSong = useCallback((song) => socket.emit('add_song', { roomId, songData: song }), [roomId]);
  const removeSong = useCallback((songId) => socket.emit('remove_song', { roomId, songId }), [roomId]);
  const approveRequest = useCallback((requestId) => socket.emit('approve_song_request', { roomId, requestId }), [roomId]);
  const rejectRequest = useCallback((requestId) => socket.emit('reject_song_request', { roomId, requestId }), [roomId]);

  // Waits for the server broadcast instead of flipping optimistically.
  const toggleVoting = useCallback(() => {
    setTogglingVoting(true);
    socket.emit('toggle_voting', { roomId, isOpen: !votingOpen });
  }, [roomId, votingOpen]);

  return {
    songs,
    loaded,
    connected,
    votingOpen,
    votedIds,
    pendingIds,
    requests,
    togglingVoting,
    joinError,
    requestState,
    vote,
    submitRequest,
    addSong,
    removeSong,
    approveRequest,
    rejectRequest,
    toggleVoting
  };
}
