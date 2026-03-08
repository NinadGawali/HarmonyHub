import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX } from 'lucide-react';

export default function MusicPlayer({ songs, autoPlay = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);

  const currentSong = songs[currentIndex];

  // Debug: Log song preview URL
  useEffect(() => {
    if (currentSong) {
      console.log('Current song:', currentSong.title);
      console.log('Preview URL:', currentSong.previewUrl || 'NOT AVAILABLE');
    }
  }, [currentSong]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (autoPlay && songs.length > 0) {
      playCurrentSong();
    }
  }, [currentIndex, autoPlay]);

  // Auto-skip if current song has no preview
  useEffect(() => {
    const hasValidPreview = currentSong?.previewUrl && currentSong.previewUrl.trim() !== '';
    if (!hasValidPreview && songs.length > 1 && currentIndex < songs.length - 1) {
      // Auto-skip to next song after 1 second
      const timer = setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentSong, songs.length]);

  const playCurrentSong = () => {
    const hasValidPreview = currentSong?.previewUrl && currentSong.previewUrl.trim() !== '';
    if (audioRef.current && hasValidPreview) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePlayPause = () => {
    const hasValidPreview = currentSong?.previewUrl && currentSong.previewUrl.trim() !== '';
    if (!audioRef.current || !hasValidPreview) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    if (currentIndex < songs.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsPlaying(false);
    }
  };

  const handleEnded = () => {
    if (currentIndex < songs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  if (!songs || songs.length === 0) {
    return (
      <div className="music-player">
        <div className="player-empty">
          🎵 No songs to play
        </div>
      </div>
    );
  }

  const hasValidPreview = currentSong?.previewUrl && currentSong.previewUrl.trim() !== '';

  if (!hasValidPreview) {
    return (
      <div className="music-player">
        <div className="player-empty">
          ⚠️ Preview not available for "{currentSong?.title || 'this song'}"
          {currentIndex < songs.length - 1 && <div>Skipping to next...</div>}
        </div>
        {currentIndex < songs.length - 1 && (
          <button onClick={handleNext} className="player-next-btn">
            Skip Now
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="music-player">
      <audio
        ref={audioRef}
        src={currentSong.previewUrl}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="player-info">
        {currentSong.image && (
          <img src={currentSong.image} alt={currentSong.title} className="player-image" />
        )}
        <div className="player-text">
          <h4 className="player-title">{currentSong.title}</h4>
          <p className="player-artist">{currentSong.artist}</p>
          <p className="player-stats">
            🏆 Rank #{currentIndex + 1} • {currentSong.votes || 0} votes
          </p>
        </div>
      </div>

      <div className="player-controls">
        <button onClick={handlePlayPause} className="player-btn play-pause">
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        
        {currentIndex < songs.length - 1 && (
          <button onClick={handleNext} className="player-btn">
            <SkipForward size={20} />
          </button>
        )}
      </div>

      <div className="player-volume">
        <button onClick={toggleMute} className="volume-btn">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={isMuted ? 0 : volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="volume-slider"
        />
      </div>

      <div className="player-queue">
        <p>Playing {currentIndex + 1} of {songs.length}</p>
      </div>
    </div>
  );
}
