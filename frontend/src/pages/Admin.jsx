import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Inbox, ListMusic, Lock, LockOpen, QrCode, Search, Trophy, X } from 'lucide-react';
import { roomAPI } from '../api/api';
import useRoomSocket from '../hooks/useRoomSocket';
import usePlayback from '../hooks/usePlayback';
import Leaderboard from '../components/Leaderboard';
import PlayerBar from '../components/PlayerBar';
import ShareRoom from '../components/ShareRoom';
import SpotifySearch from '../components/SpotifySearch';
import RoomError from '../components/RoomError';
import PartyHeader from '../components/layout/PartyHeader';
import { Button, Card, CardHeader, EmptyState, Modal, PageSpinner, TabPanel, Tabs } from '../components/ui';
import styles from './Admin.module.css';

const TAB_PREFIX = 'admin';

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function RequestList({ requests, onApprove, onReject }) {
  if (!requests.length) {
    return <EmptyState compact icon={Inbox} title="No requests" description="Guest requests show up here." />;
  }

  return (
    <ul className={styles.requests}>
      {requests.map((request) => (
        <li key={request.requestId} className={styles.request}>
          <div className={styles.requestText}>
            <p className={styles.requestQuery}>{request.query}</p>
            <p className={styles.requestBy}>from {request.userName || 'Guest'}</p>
          </div>
          <div className={styles.requestActions}>
            <Button size="sm" iconOnly variant="secondary" icon={X} onClick={() => onReject(request.requestId)} aria-label={`Decline ${request.query}`} />
            <Button size="sm" icon={Check} onClick={() => onApprove(request.requestId)}>Add</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AdminView({ roomId, room }) {
  const [tab, setTab] = useState('search');
  const [shareOpen, setShareOpen] = useState(false);
  const playback = usePlayback({
    songs: room.songs,
    playerName: `HarmonyHub party · ${roomId}`,
    returnPath: `/admin/${roomId}`,
    mode: 'votes'
  });

  const inRoom = new Set(room.songs.map((song) => song.songId));
  const totalVotes = room.songs.reduce((sum, song) => sum + (song.votes || 0), 0);

  return (
    <div className={styles.page}>
      <PartyHeader
        roomId={roomId}
        role="Hosting"
        connected={room.connected}
        votingOpen={room.votingOpen}
        actions={(
          <>
            <Button variant="secondary" size="sm" icon={QrCode} onClick={() => setShareOpen(true)}>Invite</Button>
            <Button
              variant={room.votingOpen ? 'secondary' : 'primary'}
              size="sm"
              icon={room.votingOpen ? Lock : LockOpen}
              onClick={room.toggleVoting}
              loading={room.togglingVoting}
              disabled={!room.connected}
            >
              {room.votingOpen ? 'Close voting' : 'Open voting'}
            </Button>
          </>
        )}
      />

      <main className={`container ${styles.main}`}>
        <section className={styles.stats} aria-label="Room stats">
          <Stat label="Songs" value={room.songs.length} />
          <Stat label="Votes" value={totalVotes} />
          <Stat label="Requests" value={room.requests.length} />
        </section>

        <div className={styles.grid}>
          <Card padding="sm" className={styles.board}>
            <div className={styles.boardHeader}>
              <CardHeader
                icon={Trophy}
                title={room.votingOpen ? 'Live rankings' : 'Final rankings'}
                subtitle="Tap a song to play it now. Party mode plays the top-voted song next."
              />
            </div>
            <Leaderboard
              songs={room.songs}
              currentId={playback.currentId}
              onRemove={room.removeSong}
              onSelect={(song) => playback.play(song.songId)}
              emptyAction={<Button variant="secondary" size="sm" icon={QrCode} onClick={() => setShareOpen(true)}>Invite guests</Button>}
            />
          </Card>

          <Card className={styles.sidebar}>
            <Tabs
              idPrefix={TAB_PREFIX}
              label="Queue tools"
              active={tab}
              onChange={setTab}
              tabs={[
                { id: 'search', label: 'Add songs', icon: Search },
                { id: 'requests', label: 'Requests', icon: ListMusic, badge: room.requests.length || null }
              ]}
            />
            <div className={styles.panel}>
              {tab === 'search' ? (
                <TabPanel id="search" idPrefix={TAB_PREFIX}>
                  <SpotifySearch onAdd={room.addSong} isAdded={(songId) => inRoom.has(songId)} />
                </TabPanel>
              ) : (
                <TabPanel id="requests" idPrefix={TAB_PREFIX}>
                  <RequestList requests={room.requests} onApprove={room.approveRequest} onReject={room.rejectRequest} />
                </TabPanel>
              )}
            </div>
          </Card>
        </div>

        <PlayerBar playback={playback} label="Party mode: top-voted plays next" />
      </main>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Invite guests">
        <ShareRoom roomId={roomId} />
      </Modal>
    </div>
  );
}

export default function Admin() {
  const { roomId } = useParams();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  // Only the host may open the admin panel; the server is the source of truth.
  useEffect(() => {
    let cancelled = false;
    roomAPI.get(roomId)
      .then(({ data }) => {
        if (cancelled) return;
        if (data.isHost) {
          setStatus('ready');
        } else {
          setError('Only the host can manage this room.');
          setStatus('forbidden');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.status === 404 ? 'This room does not exist or has ended.' : 'Could not load the room.');
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [roomId]);

  const room = useRoomSocket({ roomId, enabled: status === 'ready' });

  if (status === 'loading') return <PageSpinner label="Loading room" />;
  if (status === 'forbidden') {
    return <RoomError message={error} action={<Button to={`/room/${roomId}`}>Open as guest</Button>} />;
  }
  if (status === 'error' || room.joinError) return <RoomError message={error || room.joinError} />;
  if (!room.loaded) return <PageSpinner label="Connecting" />;

  return <AdminView roomId={roomId} room={room} />;
}
