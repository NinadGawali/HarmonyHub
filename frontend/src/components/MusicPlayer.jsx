import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music } from 'lucide-react';

export default function MusicPlayer({ songs, autoPlay = false, initialSongId = null }) {
  const [playableQueue, setPlayableQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  const audioRef = useRef(null);
  const advancingRef = useRef(false);

  const currentSong = playableQueue[currentQueueIndex];

  const formatTime = useCallback((seconds) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, []);

  // Build queue from room songs while preserving currently playing song when possible.
  useEffect(() => {
    setPlayableQueue((previousQueue) => {
      const filtered = (songs || []).filter((song) => song?.previewUrl?.trim());

      if (!filtered.length) {
        setCurrentQueueIndex(0);
        setIsPlaying(false);
        return filtered;
      }

      const currentSongId = previousQueue[currentQueueIndex]?.songId;
      const preservedIndex = currentSongId
        ? filtered.findIndex((song) => song.songId === currentSongId)
        : -1;

      setCurrentQueueIndex(preservedIndex >= 0 ? preservedIndex : 0);
      return filtered;
    });
  }, [songs]);

  useEffect(() => {
    if (!initialSongId || !playableQueue.length) {
      return;
    }

    const nextIndex = playableQueue.findIndex((song) => song.songId === initialSongId);
    if (nextIndex >= 0) {
      setCurrentQueueIndex(nextIndex);
    }
  }, [initialSongId, playableQueue]);

  useEffect(() => {
    if (currentSong) {
      console.log(`🎵 Queue Index: ${currentQueueIndex + 1}/${playableQueue.length}`);
      console.log(`   Title: ${currentSong.title}`);
      console.log(`   Artist: ${currentSong.artist}`);
    }
  }, [currentSong, currentQueueIndex, playableQueue.length]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const advanceToNextSong = useCallback(() => {
    if (advancingRef.current) {
      return;
    }

    if (currentQueueIndex < playableQueue.length - 1) {
      advancingRef.current = true;
      setCurrentQueueIndex((prev) => prev + 1);
      setIsPlaying(true);
      setPositionSec(0);
      window.setTimeout(() => {
        advancingRef.current = false;
      }, 150);
      return;
    }

    setIsPlaying(false);
  }, [currentQueueIndex, playableQueue.length]);

  // Start playback when queue is available.
  useEffect(() => {
    if (!audioRef.current || !autoPlay || !playableQueue.length) {
      return;
    }

    const shouldAutoStart = isPlaying || currentQueueIndex === 0;
    if (shouldAutoStart) {
      window.setTimeout(() => {
        audioRef.current?.play().catch((err) => {
          console.warn('Auto-play start failed:', err.message);
        });
      }, 500);
    }
  }, [autoPlay, playableQueue.length, currentQueueIndex, isPlaying]);

  const handleAudioEnded = useCallback(() => {
    console.log('🔚 Song ended');
    advanceToNextSong();
  }, [advanceToNextSong]);

  // Fallback: detect manual seek-to-end and force queue advance.
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) {
      return;
    }

    const currentTime = audioRef.current.currentTime;
    const duration = Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0;

    setPositionSec(currentTime);
    if (duration > 0) {
      setDurationSec(duration);
    }

    if (autoPlay && isPlaying && duration > 0 && currentTime >= duration - 0.2) {
      advanceToNextSong();
    }
  }, [advanceToNextSong, autoPlay, isPlaying]);

  // Play current song
  const playSong = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch((err) => {
        console.error('Play failed:', err.message);
      });
      setIsPlaying(true);
    }
  }, []);

  // Pause current song
  const pauseSong = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // Toggle play/pause
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseSong();
    } else {
      playSong();
    }
  }, [isPlaying, playSong, pauseSong]);

  const handleSkipNext = useCallback(() => {
    advanceToNextSong();
  }, [advanceToNextSong]);

  const handleSkipPrev = useCallback(() => {
    if (currentQueueIndex > 0) {
      setCurrentQueueIndex((prev) => prev - 1);
      setIsPlaying(true);
      setPositionSec(0);
    }
  }, [currentQueueIndex]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleSeek = useCallback((event) => {
    if (!audioRef.current) {
      return;
    }

    const nextTime = Number(event.target.value);
    audioRef.current.currentTime = nextTime;
    setPositionSec(nextTime);
  }, []);

  if (!playableQueue || playableQueue.length === 0) {
    return (
      <div className="music-player">
        <div className="player-empty">
          <Music size={32} />
          <p>No playable songs in queue</p>
          <small>Songs need preview URLs</small>
        </div>
      </div>
    );
  }

  return (
    <div className="music-player">
      <div className="player-top-row">
        <span className="player-now-playing">Now Playing</span>
        <span className="player-queue-chip">{currentQueueIndex + 1} / {playableQueue.length}</span>
      </div>

      <audio
        ref={audioRef}
        key={currentSong?.songId}
        src={currentSong?.previewUrl}
        onEnded={handleAudioEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDurationSec(Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        crossOrigin="anonymous"
      />

      <div className="player-info">
        {currentSong?.image && (
          <img src={currentSong.image} alt={currentSong.title} className="player-image" />
        )}
        <div className="player-text">
          <h4 className="player-title">{currentSong?.title}</h4>
          <p className="player-artist">{currentSong?.artist}</p>
          <p className="player-stats">
            Rank #{currentQueueIndex + 1} • {currentSong?.votes || 0} votes • Queue {playableQueue.length}
          </p>
        </div>
      </div>

      <div className="player-progress-wrap">
        <span className="player-time">{formatTime(positionSec)}</span>
        <input
          type="range"
          min="0"
          max={Math.max(durationSec, 1)}
          step="0.1"
          value={Math.min(positionSec, durationSec || 0)}
          onChange={handleSeek}
          className="player-progress"
        />
        <span className="player-time">{formatTime(durationSec)}</span>
      </div>

      <div className="player-controls">
        <button
          onClick={handleSkipPrev}
          className="player-btn"
          title="Previous"
          disabled={currentQueueIndex === 0}
        >
          <SkipBack size={20} />
        </button>

        <button onClick={handlePlayPause} className="player-btn play-pause" title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>

        <button
          onClick={handleSkipNext}
          className="player-btn"
          title="Next"
          disabled={currentQueueIndex >= playableQueue.length - 1}
        >
          <SkipForward size={20} />
        </button>
      </div>

      <div className="player-volume">
        <button onClick={toggleMute} className="volume-btn" title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={isMuted ? 0 : volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="volume-slider"
          title="Volume"
        />
      </div>

      <div className="player-queue">
        <p>
          Queue: {currentQueueIndex + 1} / {playableQueue.length}
          {autoPlay && <span> (auto-play)</span>}
        </p>
      </div>
    </div>
  );
}
