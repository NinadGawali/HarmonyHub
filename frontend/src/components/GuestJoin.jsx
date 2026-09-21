import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, TextInput } from './ui';
import BrandMark from './layout/BrandMark';
import styles from '../pages/AuthScreen.module.css';

// Shown when someone opens a room link without a session: join as a guest or with Spotify.
export default function GuestJoin({ roomId }) {
  const { joinAsGuest, loginWithSpotify } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Enter your name so others know who voted.');
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
    <div className={styles.screen}>
      <Card padding="lg" className={styles.card}>
        <BrandMark compact />
        <h1 className={styles.title}>
          Join room <span className={styles.code}>{roomId}</span>
        </h1>
        <p className={styles.text}>Pick a name and start voting. No account needed.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <TextInput
            label="Your name"
            hideLabel
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            autoComplete="nickname"
            autoFocus
            disabled={busy}
            error={error}
          />
          <Button type="submit" size="lg" fullWidth icon={LogIn} loading={busy}>Join as guest</Button>
        </form>

        <div className={styles.divider}>or</div>

        <Button variant="spotify" fullWidth onClick={() => loginWithSpotify(`/room/${roomId}`)} disabled={busy}>
          Continue with Spotify
        </Button>
      </Card>
    </div>
  );
}
