import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { songAPI } from '../api/api';
import useSocket from '../hooks/useSocket';
import Leaderboard from '../components/Leaderboard';
import SideSongPlayer from '../components/SideSongPlayer';
import { socket } from '../socket/socket';
import { ArrowLeft, Users, Wifi, WifiOff } from 'lucide-react';
import useSpotifyPlayer from '../spotify/hooks/useSpotifyPlayer';
import { useToast } from '../components/Toast';
import { resolveRoomIdentity } from '../utils/roomIdentity';

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
  const [pendingVotes, setPendingVotes] = useState(new Set());
  const [songRequest, setSongRequest] = useState('');
  const [requestStatus, setRequestStatus] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [spotifyUiError, setSpotifyUiError] = useState('');
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [{ userId, userName }] = useState(() => resolveRoomIdentity(roomId, location.state));
  const toast = useToast();

  const {
    isAuthenticated: spotifyAuthenticated,
    playerReady: spotifyReady,
    deviceId: spotifyDeviceId,
    status: spotifyStatus,
    playbackState,
    error: spotifyError,
    startLogin,
    initializePlayer,
    transferPlaybackHere,
    playTrack,
    pausePlayback,
    resumePlayback,
    seekTo
  } = useSpotifyPlayer({
    playerName: `HarmonyHub Room ${roomId}`
  });

  useEffect(() => {
    if (!selectedSongId) {
      return;
    }

    const stillExists = songs.some((song) => song.songId === selectedSongId);
    if (!stillExists) {
      setSelectedSongId(null);
    }
  }, [selectedSongId, songs]);

  const ensureSpotifyReady = useCallback(async () => {
    if (!spotifyAuthenticated) {
      await startLogin(`/room/${roomId}`);
      return false;
    }

    if (!spotifyReady) {
      await initializePlayer();
    }

    // Always transfer playback here so the local Web Playback device becomes active.
    await transferPlaybackHere(false);

    return true;
  }, [initializePlayer, roomId, spotifyAuthenticated, spotifyReady, startLogin, transferPlaybackHere]);

  const playSongById = useCallback(async (songId, positionMs = 0) => {
    if (!songId) {
      return;
    }

    setSpotifyUiError('');

    try {
      const ready = await ensureSpotifyReady();
      if (!ready) {
        return;
      }

      await playTrack(`spotify:track:${songId}`, positionMs);
      setSelectedSongId(songId);
    } catch (error) {
      console.error('Failed to play selected song:', error);
      setSpotifyUiError(error.message || 'Failed to play song on Spotify');
    }
  }, [ensureSpotifyReady, playTrack]);

  // Handle leaderboard updates
  const handleLeaderboardUpdate = useCallback((leaderboard) => {
    setSongs(leaderboard);
  }, []);

  // Connect to socket
  useSocket(roomId, handleLeaderboardUpdate, userId);

  // Monitor connection status
  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    
    const handleVotingStatus = (data) => {
      setVotingOpen(data.isOpen);
    };

    const clearPending = (songId) => {
      setPendingVotes((prev) => {
        const next = new Set(prev);
        next.delete(songId);
        return next;
      });
    };

    const handleVoteSuccess = (data) => {
      clearPending(data.songId);
      setVotedSongs((prev) => new Set([...prev, data.songId]));
    };

    const handleVoteRejected = (data) => {
      clearPending(data?.songId);
      if (data?.code === 'ALREADY_VOTED') {
        setVotedSongs((prev) => new Set([...prev, data.songId]));
      }
      toast.error(data?.message || 'Your vote could not be recorded');
    };

    const handleMyVotes = (data) => {
      setVotedSongs(new Set(data?.songIds || []));
    };

    const handleSocketError = (data) => {
      setSubmittingRequest(false);
      toast.error(data?.message || 'Something went wrong');
    };

    const handleRequestSubmitted = (data) => {
      setSubmittingRequest(false);
      setRequestStatus(data?.message || 'Request sent to admin');
      setSongRequest('');
    };

    const handleRequestProcessed = (data) => {
      if (data?.status === 'approved') {
        const message = `Your request was approved${data.songTitle ? `: ${data.songTitle}` : ''}`;
        setRequestStatus(message);
        toast.success(message);
      }
      if (data?.status === 'rejected') {
        setRequestStatus('Your request was rejected by admin');
        toast.info('Your request was rejected by admin');
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('voting_status_changed', handleVotingStatus);
    socket.on('vote_success', handleVoteSuccess);
    socket.on('vote_rejected', handleVoteRejected);
    socket.on('my_votes', handleMyVotes);
    socket.on('error', handleSocketError);
    socket.on('song_request_submitted', handleRequestSubmitted);
    socket.on('song_request_processed', handleRequestProcessed);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('voting_status_changed', handleVotingStatus);
      socket.off('vote_success', handleVoteSuccess);
      socket.off('vote_rejected', handleVoteRejected);
      socket.off('my_votes', handleMyVotes);
      socket.off('error', handleSocketError);
      socket.off('song_request_submitted', handleRequestSubmitted);
      socket.off('song_request_processed', handleRequestProcessed);
    };
  }, [toast]);

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
    if (votedSongs.has(songId) || pendingVotes.has(songId)) {
      return;
    }

    if (!votingOpen) {
      toast.info('Voting is closed');
      return;
    }

    if (!socket.connected) {
      toast.error('You are offline. Reconnecting...');
      return;
    }

    setPendingVotes((prev) => new Set([...prev, songId]));
    socket.emit('vote_song', { roomId, songId, userId });
  };

  const handleSongSelect = (song) => {
    if (!song?.songId) {
      return;
    }

    playSongById(song.songId, 0);
  };

  const handleConnectSpotify = async () => {
    setSpotifyUiError('');
    try {
      await ensureSpotifyReady();
    } catch (error) {
      setSpotifyUiError(error.message || 'Failed to connect Spotify player');
    }
  };

  const currentSongIndex = songs.findIndex((song) => song.songId === selectedSongId);
  const canGoPrev = currentSongIndex > 0;
  const canGoNext = currentSongIndex >= 0 && currentSongIndex < songs.length - 1;

  const handlePrevSong = async () => {
    if (!canGoPrev) {
      return;
    }

    const previousSong = songs[currentSongIndex - 1];
    await playSongById(previousSong?.songId, 0);
  };

  const handleNextSong = async () => {
    if (!canGoNext) {
      return;
    }

    const nextSong = songs[currentSongIndex + 1];
    await playSongById(nextSong?.songId, 0);
  };

  const handleTogglePlayPause = async () => {
    setSpotifyUiError('');
    try {
      const ready = await ensureSpotifyReady();
      if (!ready) {
        return;
      }

      if (playbackState?.isPaused) {
        await resumePlayback();
      } else {
        await pausePlayback();
      }
    } catch (error) {
      setSpotifyUiError(error.message || 'Failed to update playback state');
    }
  };

  const handleSeek = async (positionMs) => {
    setSpotifyUiError('');
    try {
      const ready = await ensureSpotifyReady();
      if (!ready) {
        return;
      }

      await seekTo(positionMs);
    } catch (error) {
      setSpotifyUiError(error.message || 'Failed to seek playback');
    }
  };

  const handleSongRequestSubmit = (e) => {
    e.preventDefault();

    if (!songRequest.trim()) {
      return;
    }

    setSubmittingRequest(true);
    setRequestStatus('');

    socket.emit('submit_song_request', {
      roomId,
      userId,
      userName,
      query: songRequest.trim()
    });
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
        <section className="song-request-panel">
          <h3>Request a Song from Admin</h3>
          <form onSubmit={handleSongRequestSubmit} className="song-request-form">
            <input
              type="text"
              placeholder="Enter song name or Spotify link"
              value={songRequest}
              onChange={(e) => setSongRequest(e.target.value)}
              disabled={submittingRequest}
            />
            <button type="submit" className="btn-primary" disabled={submittingRequest || !songRequest.trim()}>
              {submittingRequest ? 'Sending...' : 'Send Request'}
            </button>
          </form>
          {requestStatus && <p className="request-status-message">{requestStatus}</p>}
        </section>

        {!votingOpen && (
          <div className="voting-closed-banner">
            🔒 Voting is closed - Results are final!
          </div>
        )}
        
        <div className="room-main-grid">
          <div className="room-main-leaderboard">
            <Leaderboard
              songs={songs}
              onVote={handleVote}
              showVoteButton={votingOpen}
              isAdmin={false}
              votedSongs={votedSongs}
              pendingVotes={pendingVotes}
              onSongSelect={handleSongSelect}
              activeSongId={selectedSongId}
            />
          </div>

          <SideSongPlayer
            songs={songs}
            selectedSongId={selectedSongId}
            spotifyReady={spotifyReady}
            spotifyAuthenticated={spotifyAuthenticated}
            spotifyStatus={spotifyStatus}
            spotifyDeviceId={spotifyDeviceId}
            spotifyError={spotifyUiError || spotifyError}
            playbackState={playbackState}
            onConnectSpotify={handleConnectSpotify}
            onTogglePlayPause={handleTogglePlayPause}
            onSeek={handleSeek}
            onPrev={handlePrevSong}
            onNext={handleNextSong}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            currentIndex={Math.max(currentSongIndex, 0)}
            totalSongs={songs.length}
          />
        </div>
      </main>
    </div>
  );
}
