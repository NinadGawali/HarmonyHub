import React from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card } from '../components/ui';
import BrandMark from '../components/layout/BrandMark';
import styles from './AuthScreen.module.css';

const safeReturnTo = (value) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/');

export default function Login() {
  const [searchParams] = useSearchParams();
  const { loading, isSpotifyUser, user, loginWithSpotify } = useAuth();

  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const error = searchParams.get('error');

  if (!loading && isSpotifyUser) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <div className={styles.screen}>
      <Card padding="lg" className={styles.card}>
        <BrandMark compact />
        <h1 className={styles.title}>Log in with Spotify</h1>
        <p className={styles.text}>Hosting parties and building playlists use your Spotify account.</p>

        {error && (
          <p className={styles.alert} role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        {user?.isGuest && (
          <p className={styles.note}>You are currently joined as guest <strong>{user.displayName}</strong>.</p>
        )}

        <Button variant="spotify" size="lg" fullWidth onClick={() => loginWithSpotify(returnTo)} disabled={loading}>
          Continue with Spotify
        </Button>

        <p className={styles.note}>
          Just joining a party? You don&apos;t need an account. Open the room link or enter the code on the{' '}
          <Link to="/party" className={styles.link}>Party</Link> page.
        </p>
      </Card>
    </div>
  );
}
