import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, MessageSquarePlus, Send, Trophy } from 'lucide-react';
import { roomAPI } from '../api/api';
import { useAuth } from '../auth/AuthProvider';
import useRoomSocket from '../hooks/useRoomSocket';
import usePlayback from '../hooks/usePlayback';
import Leaderboard from '../components/Leaderboard';
import PlayerBar from '../components/PlayerBar';
import GuestJoin from '../components/GuestJoin';
import UserMenu from '../components/UserMenu';
import PartyHeader from '../components/layout/PartyHeader';
import RoomError from '../components/RoomError';
import { Button, Card, CardHeader, PageSpinner, TextInput } from '../components/ui';
import styles from './Room.module.css';

const MAX_REQUEST_LENGTH = 200;

function RequestSongCard({ requestState, onSubmit }) {
  const [query, setQuery] = useState('');

  // Clear the field once the server confirmed the request.
  useEffect(() => {
    if (!requestState.sending && requestState.message) setQuery('');
  }, [requestState]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (query.trim()) onSubmit(query.trim());
  };

  return (
    <Card>
      <CardHeader icon={MessageSquarePlus} title="Request a song" subtitle="The host decides what gets added." />
      <form className={styles.requestForm} onSubmit={handleSubmit}>
        <TextInput
          label="Song name or Spotify link"
          hideLabel
          placeholder="Song or Spotify link"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={MAX_REQUEST_LENGTH}
          disabled={requestState.sending}
        />
        <Button type="submit" icon={Send} loading={requestState.sending} disabled={!query.trim()}>
          Send
        </Button>
      </form>
      {requestState.message && <p className={styles.requestStatus} role="status">{requestState.message}</p>}
    </Card>
  );
}

function RoomView({ roomId, room, isSpotifyUser }) {
  // Spotify users can listen along in this browser; guests only vote.
  const playback = usePlayback({
    songs: room.songs,
    playerName: `HarmonyHub · ${roomId}`,
    returnPath: `/room/${roomId}`
  });
  const votesLeft = room.songs.filter((song) => !room.votedIds.has(song.songId)).length;

  return (
    <div className={styles.page}>
      <PartyHeader
        roomId={roomId}
        role="Guest"
        connected={room.connected}
        votingOpen={room.votingOpen}
        actions={<UserMenu />}
      />

      <main className={`container ${styles.main}`}>
        {!room.votingOpen && (
          <div className={styles.closedBanner} role="status">
            <Lock size={18} aria-hidden="true" />
            <span>Voting is closed. The host will reopen it for the next round.</span>
          </div>
        )}

        <div className={styles.grid}>
          <Card padding="sm" className={styles.board}>
            <div className={styles.boardHeader}>
              <CardHeader
                icon={Trophy}
                title="Live leaderboard"
                subtitle={room.songs.length
                  ? `${room.songs.length} songs · ${votesLeft} left to vote on`
                  : 'Waiting for the first song'}
              />
            </div>
            <Leaderboard
              songs={room.songs}
              votedIds={room.votedIds}
              pendingIds={room.pendingIds}
              votingOpen={room.votingOpen}
              currentId={isSpotifyUser ? playback.currentId : null}
              onVote={room.vote}
              onSelect={isSpotifyUser ? (song) => playback.play(song.songId) : undefined}
            />
          </Card>

          <aside className={styles.sidebar}>
            <RequestSongCard requestState={room.requestState} onSubmit={room.submitRequest} />
            <Card className={styles.tips}>
              <h2 className={styles.tipsTitle}>How it works</h2>
              <ul>
                <li>You get one vote per song. Tap the arrow to vote.</li>
                <li>The list reorders live as votes come in.</li>
                <li>The host plays the top-voted songs.</li>
              </ul>
            </Card>
          </aside>
        </div>

        {isSpotifyUser && <PlayerBar playback={playback} label="Plays in this browser" />}
      </main>
    </div>
  );
}

export default function Room() {
  const { roomId } = useParams();
  const { user, loading: authLoading, isSpotifyUser } = useAuth();
  const [entered, setEntered] = useState(false);
  const [enterError, setEnterError] = useState('');

  // Register membership and confirm the room exists before opening the socket.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setEnterError('');

    roomAPI.join(roomId)
      .then(() => { if (!cancelled) setEntered(true); })
      .catch((err) => {
        if (cancelled) return;
        setEnterError(err.response?.status === 404
          ? 'This room does not exist or has ended.'
          : err.response?.data?.error || 'Could not open the room.');
      });

    return () => { cancelled = true; };
  }, [roomId, user]);

  const room = useRoomSocket({ roomId, enabled: entered });

  if (authLoading) return <PageSpinner />;
  if (!user) return <GuestJoin roomId={roomId} />;

  const error = enterError || room.joinError;
  if (error) return <RoomError message={error} />;
  if (!entered || !room.loaded) return <PageSpinner label="Joining room" />;

  return <RoomView roomId={roomId} room={room} isSpotifyUser={isSpotifyUser} />;
}
