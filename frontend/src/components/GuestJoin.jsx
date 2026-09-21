import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Music2 } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

// Shown when someone opens a room link without a session: join as a guest or with Spotify.
export default function GuestJoin({ roomId }) {
  const navigate = useNavigate();
  const { joinAsGuest, loginWithSpotify } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await joinAsGuest(name.trim());
    } catch (err) {
      setError(err.response?.data?.error || 'Could not join. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="home-page">
      <div className="home-container guest-join">
        <div className="home-header">
          <Music2 size={56} className="logo" />
          <h1>Join room {roomId}</h1>
          <p>Pick a name to start voting. No account needed.</p>
        </div>

        <div className="home-card">
          <form onSubmit={handleSubmit} className="home-form">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              disabled={busy}
              autoComplete="nickname"
              autoFocus
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              <LogIn size={20} />
              <span>{busy ? 'Joining...' : 'Join as guest'}</span>
            </button>
          </form>

          <div className="guest-join-divider"><span>or</span></div>

          <button className="btn-secondary btn-spotify" onClick={() => loginWithSpotify(`/room/${roomId}`)} disabled={busy}>
            Continue with Spotify
          </button>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}

        <button className="btn-link" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    </div>
  );
}
