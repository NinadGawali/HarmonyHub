import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { songAPI } from '../api/api';
import useSocket from '../hooks/useSocket';
import Leaderboard from '../components/Leaderboard';
import { socket } from '../socket/socket';
import { ArrowLeft, Users, Wifi, WifiOff } from 'lucide-react';

export default function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [votingOpen, setVotingOpen] = useState(true);
  const [votedSongs, setVotedSongs] = useState(new Set());
  const userName = location.state?.userName || 'Guest';
  const [userId] = useState(`${userName}_${Date.now()}`);

  // Handle leaderboard updates
  const handleLeaderboardUpdate = useCallback((leaderboard) => {
    setSongs(leaderboard);
  }, []);

  // Connect to socket
  useSocket(roomId, handleLeaderboardUpdate);

  // Monitor connection status
  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    
    const handleVotingStatus = (data) => {
      setVotingOpen(data.isOpen);
    };

    const handleVoteSuccess = (data) => {
      setVotedSongs(prev => new Set([...prev, data.songId]));
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('voting_status_changed', handleVotingStatus);
    socket.on('vote_success', handleVoteSuccess);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('voting_status_changed', handleVotingStatus);
      socket.off('vote_success', handleVoteSuccess);
    };
  }, []);

  // Load initial leaderboard
  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const response = await songAPI.getLeaderboard(roomId);
        setSongs(response.data.leaderboard);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [roomId]);

  // Handle vote
  const handleVote = (songId) => {
    if (votedSongs.has(songId)) {
      alert('You have already voted for this song!');
      return;
    }
    
    if (!votingOpen) {
      alert('Voting is closed!');
      return;
    }

    socket.emit('vote_song', { roomId, songId, userId });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading room...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="room-page">
      <header className="room-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft size={20} />
        </button>
        
        <div className="room-info">
          <h1>Room: {roomId}</h1>
          <div className="room-meta">
            <span className="user-badge">
              <Users size={16} />
              {userName}
            </span>
            <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      <main className="room-content">
        {!votingOpen && (
          <div className="voting-closed-banner">
            🔒 Voting is closed - Results are final!
          </div>
        )}
        
        <Leaderboard
          songs={songs}
          onVote={handleVote}
          showVoteButton={votingOpen}
          isAdmin={false}
          votedSongs={votedSongs}
        />
      </main>
    </div>
  );
}
