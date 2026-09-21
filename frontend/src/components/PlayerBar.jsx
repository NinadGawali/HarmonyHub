import React, { useEffect, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Artwork, Button, Spinner } from './ui';
import { formatDuration } from '../utils/queue';
import styles from './PlayerBar.module.css';

const TICK_MS = 500;

// SDK states arrive sparsely; extrapolate the position while playing so the bar moves smoothly.
function useLivePosition(state) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!state || state.isPaused) return undefined;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [state]);

  if (!state) return 0;
  const elapsed = state.isPaused ? 0 : Math.max(0, now - state.updatedAt);
  return Math.min(state.positionMs + elapsed, state.durationMs || Infinity);
}

/**
 * Sticky now-playing bar driven by `usePlayback`.
 * `label` explains the queue behaviour (e.g. "Party mode: top-voted plays next").
 */
export default function PlayerBar({ playback, label }) {
  const {
    currentTrack, playbackState, isAuthenticated, playerReady, busy, error,
    canNext, canPrevious, toggle, next, previous, seek, connect
  } = playback;
  const position = useLivePosition(playbackState);
  const duration = playbackState?.durationMs || 0;
  const isPlaying = Boolean(currentTrack && playbackState && !playbackState.isPaused);

  const title = currentTrack?.title || playbackState?.trackName || 'Nothing playing';
  const subtitle = currentTrack?.artist || playbackState?.artistName || 'Pick a song or press play';

  return (
    <div className={styles.bar} role="region" aria-label="Player">
      <div className={styles.track}>
        <Artwork src={currentTrack?.image} seed={title} size={48} />
        <div className={styles.meta}>
          <p className={styles.title}>{title}</p>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>

      <div className={styles.center}>
        {isAuthenticated && playerReady ? (
          <>
            <div className={styles.controls}>
              <button type="button" className={styles.control} onClick={previous} disabled={!canPrevious || busy} aria-label="Previous song">
                <SkipBack size={18} />
              </button>
              <button
                type="button"
                className={`${styles.control} ${styles.main}`}
                onClick={toggle}
                disabled={busy || (!currentTrack && !canNext)}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {busy ? <Spinner size={18} /> : isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button type="button" className={styles.control} onClick={next} disabled={!canNext || busy} aria-label="Next song">
                <SkipForward size={18} />
              </button>
            </div>
            <div className={styles.progress}>
              <span>{formatDuration(position)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(duration, 1000)}
                step={1000}
                value={Math.min(position, duration)}
                onChange={(event) => seek(Number(event.target.value))}
                disabled={!currentTrack}
                aria-label="Seek"
                style={{ '--progress': `${duration ? (position / duration) * 100 : 0}%` }}
              />
              <span>{formatDuration(duration)}</span>
            </div>
          </>
        ) : (
          <Button variant={isAuthenticated ? 'secondary' : 'spotify'} size="sm" onClick={connect} loading={busy}>
            {isAuthenticated ? 'Connect player' : 'Log in with Spotify to play'}
          </Button>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>

      <div className={styles.aside}>
        {label && <span className={styles.label}>{label}</span>}
      </div>
    </div>
  );
}
