import React from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Music2, Home } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

const safeReturnTo = (value) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/');

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loading, isSpotifyUser, user, loginWithSpotify } = useAuth();

  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const error = searchParams.get('error');

  if (!loading && isSpotifyUser) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <div className="home-page login-page">
      <div className="home-container login-container">
        <div className="party-room-topbar">
          <button className="btn-secondary" onClick={() => navigate('/')}>
            <Home size={18} />
            <span>Back to Home</span>
          </button>
        </div>

        <div className="home-header">
          <Music2 size={64} className="logo" />
          <h1>Log in to HarmonyHub</h1>
          <p>Hosting parties and building playlists uses your Spotify account.</p>
        </div>

        <div className="home-card login-card">
          {user?.isGuest && (
            <p className="login-note">
              You are currently joined as guest <strong>{user.displayName}</strong>.
            </p>
          )}

          <button className="btn-primary btn-spotify" onClick={() => loginWithSpotify(returnTo)} disabled={loading}>
            Continue with Spotify
          </button>

          <p className="login-note">
            Just joining a party? You don&apos;t need an account. Open the room link or enter the
            code on the <Link to="/party-room">Party Room</Link> page.
          </p>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}
      </div>
    </div>
  );
}
