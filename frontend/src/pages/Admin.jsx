import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { songAPI, spotifyAPI } from '../api/api';
import useSocket from '../hooks/useSocket';
import Leaderboard from '../components/Leaderboard';
import QRJoin from '../components/QRJoin';
import MusicPlayer from '../components/MusicPlayer';
import { socket } from '../socket/socket';
import { ArrowLeft, Search, Plus, Wifi, WifiOff, X, Play, Pause } from 'lucide-react';

export default function Admin() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [songs, setSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [votingOpen, setVotingOpen] = useState(true);
  const adminName = location.state?.adminName || 'Admin';

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

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  // Listen for voting status changes
  useEffect(() => {
    const handleVotingStatusChange = ({ isOpen }) => {
      setVotingOpen(isOpen);
    };

    socket.on('voting_status_changed', handleVotingStatusChange);

    return () => {
      socket.off('voting_status_changed', handleVotingStatusChange);
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

  // Search Spotify
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      return;
    }

    setSearching(true);
    setError('');

    try {
      const response = await spotifyAPI.search(searchQuery);
      setSearchResults(response.data.songs);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to search songs');
    } finally {
      setSearching(false);
    }
  };

  // Add song to room
  const handleAddSong = (song) => {
    console.log('🎵 Adding song to room:', song.title);
    console.log('Preview URL being sent:', song.previewUrl || 'NULL');
    socket.emit('add_song', {
      roomId,
      songData: song
    });
    
    // Clear search
    setSearchQuery('');
    setSearchResults([]);
  };

  // Remove song from room
  const handleRemoveSong = (songId) => {
    socket.emit('remove_song', { roomId, songId });
  };

  // Toggle voting status
  const handleToggleVoting = () => {
    const newStatus = !votingOpen;
    socket.emit('toggle_voting', { roomId, isOpen: newStatus });
    setVotingOpen(newStatus); // Optimistic update
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft size={20} />
        </button>
        
        <div className="admin-info">
          <h1>Admin Panel</h1>
          <div className="admin-meta">
            <span className="admin-badge">{adminName}</span>
            <span className="room-code-badge">Room: {roomId}</span>
            <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>

        <button 
          onClick={handleToggleVoting} 
          className={`voting-toggle-btn ${votingOpen ? 'open' : 'closed'}`}
        >
          {votingOpen ? <Pause size={20} /> : <Play size={20} />}
          {votingOpen ? 'Close Voting' : 'Open Voting'}
        </button>
      </header>

      <div className="admin-content">
        {/* Left Panel - Search & QR */}
        <aside className="admin-sidebar">
          {/* QR Code */}
          <QRJoin roomId={roomId} />

          {/* Search Section */}
          <div className="search-section">
            <h3>Add Songs</h3>
            
            <form onSubmit={handleSearch} className="search-form">
              <div className="search-input-group">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search songs on Spotify..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={searching}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="clear-button"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button type="submit" disabled={searching} className="btn-search">
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="search-results">
                <h4>Search Results</h4>
                {searchResults.map((song) => (
                  <div key={song.songId} className="search-result-item">
                    {song.image && (
                      <img src={song.image} alt={song.title} className="result-image" />
                    )}
                    <div className="result-info">
                      <p className="result-title">{song.title}</p>
                      <p className="result-artist">{song.artist}</p>
                    </div>
                    <button
                      onClick={() => handleAddSong(song)}
                      className="btn-add"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </aside>

        {/* Right Panel - Leaderboard */}
        <main className="admin-main">
          {!votingOpen && songs.length > 0 && (
            <div className="music-player-section">
              <h2 className="player-heading">🎵 Now Playing Winners</h2>
              <MusicPlayer songs={songs} autoPlay={true} />
            </div>
          )}

          <div className="leaderboard-section">
            <h2 className="section-heading">
              {votingOpen ? '🔥 Current Rankings' : '🏆 Final Results'}
            </h2>
            <Leaderboard
              songs={songs}
              showVoteButton={false}
              isAdmin={true}
              onRemove={handleRemoveSong}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
