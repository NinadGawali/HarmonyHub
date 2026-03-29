import React, { useCallback } from 'react';
import { Music, Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export default function SideSongPlayer({
  songs,
  selectedSongId,
  spotifyReady,
  spotifyAuthenticated,
  spotifyStatus,
  spotifyDeviceId,
  spotifyError,
  playbackState,
  onConnectSpotify,
  onTogglePlayPause,
  onSeek,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
  currentIndex,
  totalSongs
}) {
  const currentSong = (songs || []).find((song) => song.songId === selectedSongId) || null;

  const formatTime = useCallback((ms) => {
    const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, []);

  if (!songs?.length) {
    return (
      <aside className="side-player">
        <div className="side-player-empty">
          <Music size={28} />
          <p>No songs in this room yet.</p>
        </div>
      </aside>
    );
  }

  if (!currentSong || !selectedSongId) {
    return (
      <aside className="side-player">
        <div className="side-player-empty">
          <Music size={28} />
          <p>Click a song card to start playback.</p>
          <button className="side-player-connect-btn" onClick={onConnectSpotify}>
            {spotifyAuthenticated ? 'Connect Spotify Player' : 'Login with Spotify'}
          </button>
        </div>
      </aside>
    );
  }

  const isPaused = playbackState?.isPaused ?? true;
  const positionMs = playbackState?.positionMs || 0;
  const durationMs = playbackState?.durationMs || 0;

  return (
    <aside className="side-player">
      <p className="side-player-label">Now Playing</p>
      {currentSong.image ? (
        <img src={currentSong.image} alt={currentSong.title} className="side-player-image" />
      ) : (
        <div className="side-player-image side-player-image-fallback">
          <Music size={26} />
        </div>
      )}

      <h4 className="side-player-title">{currentSong.title}</h4>
      <p className="side-player-artist">{currentSong.artist}</p>

      <button className="side-player-connect-btn" onClick={onConnectSpotify}>
        {spotifyAuthenticated ? (spotifyReady ? 'Spotify Connected' : 'Connect Spotify Player') : 'Login with Spotify'}
      </button>

      <p className="side-player-status">
        Auth: {spotifyAuthenticated ? 'yes' : 'no'} • Player: {spotifyStatus || 'idle'}
        {spotifyDeviceId ? ` • Device: ${spotifyDeviceId}` : ''}
      </p>

      <div className="side-player-progress-wrap">
        <span>{formatTime(positionMs)}</span>
        <input
          type="range"
          min="0"
          max={Math.max(durationMs, 1000)}
          step="250"
          value={Math.min(positionMs, durationMs || 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="side-player-progress"
          disabled={!spotifyReady}
        />
        <span>{formatTime(durationMs)}</span>
      </div>

      <div className="side-player-controls">
        <button
          className="side-player-btn"
          onClick={onPrev}
          disabled={!canGoPrev}
          title="Previous"
        >
          <SkipBack size={18} />
        </button>

        <button
          className="side-player-btn side-player-btn-main"
          onClick={onTogglePlayPause}
          title="Play/Pause"
          disabled={!spotifyReady}
        >
          {isPaused ? <Play size={22} /> : <Pause size={22} />}
        </button>

        <button
          className="side-player-btn"
          onClick={onNext}
          disabled={!canGoNext}
          title="Next"
        >
          <SkipForward size={18} />
        </button>
      </div>

      <p className="side-player-queue-state">
        {currentIndex + 1} / {totalSongs}
      </p>

      {spotifyError && <p className="side-player-error">{spotifyError}</p>}
    </aside>
  );
}
