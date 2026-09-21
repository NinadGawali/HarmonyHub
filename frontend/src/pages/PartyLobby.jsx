import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, LogIn, Users } from 'lucide-react';
import { roomAPI } from '../api/api';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, CardHeader, TextInput } from '../components/ui';
import styles from './PartyLobby.module.css';

const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

export default function PartyLobby() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isSpotifyUser, loginWithSpotify, joinAsGuest } = useAuth();
  const [guestName, setGuestName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');

  const createRoom = async () => {
    setCreateError('');
    setCreating(true);
    try {
      const response = await roomAPI.create();
      navigate(`/admin/${response.data.roomId}`);
    } catch (err) {
      setCreateError(errorMessage(err, 'Could not create a room'));
      setCreating(false);
    }
  };

  const joinRoom = async (event) => {
    event.preventDefault();
    setJoinError('');

    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError('Room codes are 6 characters.');
      return;
    }
    if (!user && !guestName.trim()) {
      setJoinError('Enter your name so others know who voted.');
      return;
    }

    setJoining(true);
    try {
      if (!user) await joinAsGuest(guestName.trim());
      await roomAPI.join(code);
      navigate(`/room/${code}`);
    } catch (err) {
      setJoinError(err.response?.status === 404 ? 'No active room with that code.' : errorMessage(err, 'Could not join the room'));
      setJoining(false);
    }
  };

  return (
    <div className="container">
      <header className={styles.header}>
        <h1 className={styles.title}>Party room</h1>
        <p className={styles.subtitle}>Host a live voting session, or join one with a code.</p>
      </header>

      <div className={styles.grid}>
        <Card padding="lg" className={styles.panel}>
          <CardHeader icon={Crown} title="Host a party" subtitle="You control the queue and playback." />
          <ul className={styles.perks}>
            <li>Share a QR code; guests join without an account</li>
            <li>Add songs from Spotify and approve requests</li>
            <li>Party mode plays the top-voted song next</li>
          </ul>
          {isSpotifyUser ? (
            <Button size="lg" fullWidth icon={Crown} onClick={createRoom} loading={creating}>
              Create room as {user.displayName}
            </Button>
          ) : (
            <Button variant="spotify" size="lg" fullWidth onClick={() => loginWithSpotify('/party')} disabled={authLoading}>
              Continue with Spotify to host
            </Button>
          )}
          {createError && <p className={styles.error} role="alert">{createError}</p>}
        </Card>

        <Card padding="lg" className={styles.panel}>
          <CardHeader
            icon={Users}
            title="Join a party"
            subtitle={user ? `Joining as ${user.displayName}` : 'No account needed.'}
          />
          <form className={styles.form} onSubmit={joinRoom} noValidate>
            {!user && (
              <TextInput
                label="Your name"
                placeholder="e.g. Priya"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                maxLength={40}
                autoComplete="nickname"
                disabled={joining || authLoading}
              />
            )}
            <TextInput
              label="Room code"
              placeholder="ABC123"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              className={styles.codeInput}
              disabled={joining || authLoading}
              error={joinError}
            />
            <Button type="submit" variant="secondary" size="lg" fullWidth icon={LogIn} loading={joining}>
              Join room
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
