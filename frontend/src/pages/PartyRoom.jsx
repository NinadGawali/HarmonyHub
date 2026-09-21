import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music2, Users, Plus, LogIn, Home } from 'lucide-react';
import { roomAPI } from '../api/api';
import { useAuth } from '../auth/AuthProvider';
import UserMenu from '../components/UserMenu';

const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

export default function PartyRoom() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isSpotifyUser, loginWithSpotify, joinAsGuest } = useAuth();
  const [guestName, setGuestName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    setError('');
    setBusy(true);
    try {
      const response = await roomAPI.create();
      navigate(`/admin/${response.data.roomId}`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to create room'));
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async (event) => {
    event.preventDefault();
    setError('');

    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError('Please enter a room code');
      return;
    }
    if (!user && !guestName.trim()) {
      setError('Please enter your name');
      return;
    }

    setBusy(true);
    try {
      if (!user) {
        await joinAsGuest(guestName.trim());
      }
      await roomAPI.join(code);
      navigate(`/room/${code}`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to join room'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="home-page party-room-page">
      <div className="home-container">
        <div className="party-room-topbar">
          <button className="btn-secondary" onClick={() => navigate('/')}>
            <Home size={18} />
            <span>Back to Home</span>
          </button>
          <UserMenu />
        </div>

        <div className="home-header">
          <Music2 size={64} className="logo" />
          <h1>Party Room</h1>
          <p>Create or join a live music voting room</p>
        </div>

        <div className="home-cards">
          <div className="home-card">
            <div className="card-icon create">
              <Plus size={32} />
            </div>
            <h2>Host a Party</h2>
            <p>Start a voting session and manage the queue. Hosting uses your Spotify account.</p>

            {isSpotifyUser ? (
              <button onClick={handleCreateRoom} disabled={busy} className="btn-primary">
                <Users size={20} />
                <span>{busy ? 'Creating...' : `Create room as ${user.displayName}`}</span>
              </button>
            ) : (
              <button
                onClick={() => loginWithSpotify('/party-room')}
                disabled={authLoading}
                className="btn-primary btn-spotify"
              >
                <span>Log in with Spotify to host</span>
              </button>
            )}
          </div>

          <div className="home-card">
            <div className="card-icon join">
              <LogIn size={32} />
            </div>
            <h2>Join a Party</h2>
            <p>
              {user
                ? `Joining as ${user.displayName}.`
                : 'No account needed. Pick a name and enter the room code.'}
            </p>

            <form onSubmit={handleJoinRoom} className="home-form">
              {!user && (
                <input
                  type="text"
                  placeholder="Your name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={40}
                  disabled={busy || authLoading}
                  autoComplete="nickname"
                />
              )}
              <input
                type="text"
                placeholder="Room code (e.g., ABC123)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                disabled={busy || authLoading}
                autoCapitalize="characters"
              />
              <button type="submit" disabled={busy || authLoading} className="btn-secondary">
                <LogIn size={20} />
                <span>{busy ? 'Joining...' : 'Join Room'}</span>
              </button>
            </form>
          </div>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}
      </div>
    </div>
  );
}
