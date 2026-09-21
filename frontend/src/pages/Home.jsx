import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronUp, Library, PartyPopper, QrCode, Sparkles, Trophy, Vote } from 'lucide-react';
import { Badge, Button, Card } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import styles from './Home.module.css';

const PREVIEW_SONGS = [
  { title: 'Midnight City', artist: 'M83', votes: 14, hue: 18 },
  { title: 'Blinding Lights', artist: 'The Weeknd', votes: 11, hue: 330 },
  { title: 'Kesariya', artist: 'Arijit Singh', votes: 7, hue: 265 },
  { title: 'Titi Me Preguntó', artist: 'Bad Bunny', votes: 4, hue: 190 }
];

const FEATURES = [
  {
    icon: PartyPopper,
    title: 'Party rooms',
    text: 'Start a room, put the QR code on screen, and let guests vote from their phones. No app or account needed.',
    to: '/party',
    cta: 'Start a party'
  },
  {
    icon: Sparkles,
    title: 'AI playlists',
    text: 'Describe a mood, name an artist, and get a tracklist you can edit, save and play.',
    to: '/create',
    cta: 'Create a playlist'
  },
  {
    icon: Library,
    title: 'Your library',
    text: 'Keep your playlists in one place and play them through Spotify in the browser.',
    to: '/library',
    cta: 'Open library'
  }
];

const STEPS = [
  { icon: PartyPopper, title: 'Host a room', text: 'Log in with Spotify and create a room in one click.' },
  { icon: QrCode, title: 'Guests scan in', text: 'They join with just a name, straight from the QR code.' },
  { icon: Vote, title: 'Everyone votes', text: 'The leaderboard updates live for everyone in the room.' },
  { icon: Trophy, title: 'Top song plays', text: 'Party mode keeps playing the highest-voted song.' }
];

function LeaderboardPreview() {
  const max = PREVIEW_SONGS[0].votes;
  return (
    <Card className={styles.preview} padding="md" aria-hidden="true">
      <div className={styles.previewHeader}>
        <span className={styles.previewTitle}>Room K7Q2XP</span>
        <Badge tone="success" dot>Voting open</Badge>
      </div>
      <ol className={styles.previewList}>
        {PREVIEW_SONGS.map((song, index) => (
          <li key={song.title} className={styles.previewRow} style={{ '--delay': `${index * 90}ms` }}>
            <span className={styles.previewRank}>{index + 1}</span>
            <span
              className={styles.previewArt}
              style={{ background: `linear-gradient(135deg, hsl(${song.hue} 75% 55%), hsl(${song.hue + 50} 70% 30%))` }}
            />
            <span className={styles.previewText}>
              <strong>{song.title}</strong>
              <span>{song.artist}</span>
              <span className={styles.previewMeter} style={{ '--share': `${(song.votes / max) * 100}%` }} />
            </span>
            <span className={styles.previewVotes}>{song.votes}</span>
            <span className={styles.previewVote}><ChevronUp size={16} /></span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState('');

  const joinRoom = (event) => {
    event.preventDefault();
    const roomCode = code.trim().toUpperCase();
    if (roomCode) navigate(`/room/${roomCode}`);
  };

  return (
    <div className="container">
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <Badge tone="accent" icon={Vote}>Live music voting</Badge>
          <h1 className={styles.headline}>
            Let the room pick <span className={styles.accentText}>the next song.</span>
          </h1>
          <p className={styles.lede}>
            HarmonyHub turns any party into a live leaderboard. Guests vote from their phones and the
            top song plays next on Spotify.
          </p>

          <div className={styles.heroActions}>
            <Button to="/party" size="lg" iconRight={ArrowRight}>Host a party</Button>
            <form className={styles.joinForm} onSubmit={joinRoom}>
              <label htmlFor="home-room-code" className="visually-hidden">Room code</label>
              <input
                id="home-room-code"
                className={styles.joinInput}
                placeholder="Room code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
              />
              <Button type="submit" variant="secondary" disabled={!code.trim()}>Join</Button>
            </form>
          </div>
          {user && <p className={styles.greeting}>Welcome back, {user.displayName}.</p>}
        </div>

        <LeaderboardPreview />
      </section>

      <section className={styles.features} aria-label="What you can do">
        {FEATURES.map(({ icon: Icon, title, text, to, cta }) => (
          <Card key={title} as="article" interactive className={styles.feature}>
            <span className={styles.featureIcon}><Icon size={22} aria-hidden="true" /></span>
            <h2 className={styles.featureTitle}>{title}</h2>
            <p className={styles.featureText}>{text}</p>
            <Button to={to} variant="ghost" size="sm" iconRight={ArrowRight} className={styles.featureLink}>{cta}</Button>
          </Card>
        ))}
      </section>

      <section className={styles.steps}>
        <h2 className={styles.sectionTitle}>How a party works</h2>
        <ol className={styles.stepList}>
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className={styles.step}>
              <span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
              <Icon size={22} className={styles.stepIcon} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
