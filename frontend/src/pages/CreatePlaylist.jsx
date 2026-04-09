import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playlistAPI, locationAPI, spotifyAPI } from '../api/api';
import { Music2, Wand2, Plus, Save, Trash2, Home, Search, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat } from 'lucide-react';
import { createPlaylistRecord, getStoredPlaylists, saveStoredPlaylists } from '../utils/playlistStorage';

export default function CreatePlaylist() {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [artist, setArtist] = useState('');
  const [count, setCount] = useState(8);
  const [playlistName, setPlaylistName] = useState('My AI Playlist');
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [regionalRecommendations, setRegionalRecommendations] = useState([]);
  const [regionName, setRegionName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressSec, setProgressSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [queueOrder, setQueueOrder] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    setSavedPlaylists(getStoredPlaylists());
  }, []);

  const persistPlaylists = (items) => {
    setSavedPlaylists(items);
    saveStoredPlaylists(items);
  };

  const getLatestLocation = async () => {
    try {
      const response = await locationAPI.getLatest();
      return response?.data?.location || null;
    } catch (_error) {
      return null;
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');

    if (!description.trim()) {
      setError('Please describe the type of songs you want.');
      return;
    }

    setLoading(true);

    try {
      const location = await getLatestLocation();
      const response = await playlistAPI.generateRecommendations({
        description: description.trim(),
        artist: artist.trim(),
        count: Number(count),
        location
      });

      setAiRecommendations(response.data.aiRecommendations || []);
      setRegionalRecommendations(response.data.regionalRecommendations || []);
      setRegionName(response.data.regionName || 'Your Region');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  };

  const selectedSongIds = new Set(selectedSongs.map((song) => song.songId));

  const addSong = (song) => {
    if (selectedSongIds.has(song.songId)) {
      return;
    }

    setSelectedSongs((prev) => [...prev, song]);
  };

  const addSongAndFocus = (song) => {
    addSong(song);
    setError('');
  };

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.volume = 0.85;
  }, []);

  useEffect(() => {
    if (!selectedSongs.length) {
      setQueueOrder([]);
      setCurrentTrackIndex(0);
      setIsPlaying(false);
      return;
    }

    const ordered = [...selectedSongs];

    if (shuffleEnabled) {
      for (let index = ordered.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [ordered[index], ordered[randomIndex]] = [ordered[randomIndex], ordered[index]];
      }
    }

    setQueueOrder(ordered);
    setCurrentTrackIndex((previousIndex) => Math.min(previousIndex, ordered.length - 1));
  }, [selectedSongs, shuffleEnabled]);

  const currentPlayingSong = queueOrder[currentTrackIndex] || null;

  const formatTime = useCallback((seconds) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    setProgressSec(0);
    setDurationSec(0);
    setIsPlaying(false);
  }, [currentPlayingSong?.songId]);

  const handleSearchSongs = async (e) => {
    e.preventDefault();
    setError('');

    if (!searchQuery.trim()) {
      return;
    }

    setSearching(true);

    try {
      const response = await spotifyAPI.search(searchQuery.trim());
      setSearchResults(response.data.songs || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to search songs');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const syncAudioToTrack = useCallback((track, startAtSec = 0) => {
    if (!audioRef.current || !track?.previewUrl) {
      return;
    }

    audioRef.current.pause();
    audioRef.current.src = track.previewUrl;
    audioRef.current.currentTime = Math.max(0, startAtSec);
    audioRef.current.load();
  }, []);

  useEffect(() => {
    if (!currentPlayingSong?.previewUrl) {
      return;
    }

    syncAudioToTrack(currentPlayingSong, 0);
  }, [currentPlayingSong, syncAudioToTrack]);

  const goToTrack = (nextIndex) => {
    if (!queueOrder.length) {
      return;
    }

    const boundedIndex = Math.max(0, Math.min(nextIndex, queueOrder.length - 1));
    setCurrentTrackIndex(boundedIndex);
    setProgressSec(0);
    setIsPlaying(true);
  };

  const playCurrent = () => {
    if (!currentPlayingSong?.previewUrl || !audioRef.current) {
      setError('This song does not have a preview URL to play.');
      return;
    }

    setError('');
    audioRef.current.play().catch(() => {
      setError('Unable to play this preview in the browser.');
    });
    setIsPlaying(true);
  };

  const pauseCurrent = () => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.pause();
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      pauseCurrent();
    } else {
      playCurrent();
    }
  };

  const handleNextTrack = () => {
    if (currentTrackIndex >= queueOrder.length - 1) {
      setIsPlaying(false);
      return;
    }

    goToTrack(currentTrackIndex + 1);
  };

  const handlePrevTrack = () => {
    if (currentTrackIndex <= 0) {
      return;
    }

    goToTrack(currentTrackIndex - 1);
  };

  const handleTrackEnded = () => {
    handleNextTrack();
  };

  const handleSeek = (event) => {
    const nextTime = Number(event.target.value);
    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime = nextTime;
    setProgressSec(nextTime);
  };

  const handleShuffleToggle = () => {
    setShuffleEnabled((prev) => !prev);
    setCurrentTrackIndex(0);
  };

  const handleRepeatToggle = () => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.loop = !audioRef.current.loop;
  };

  const removeSong = (songId) => {
    setSelectedSongs((prev) => prev.filter((song) => song.songId !== songId));
  };

  const savePlaylist = () => {
    if (!playlistName.trim()) {
      setError('Please enter a playlist name before saving.');
      return;
    }

    if (selectedSongs.length === 0) {
      setError('Add at least one song to save the playlist.');
      return;
    }

    const next = [createPlaylistRecord({ name: playlistName.trim(), songs: selectedSongs }), ...savedPlaylists];

    persistPlaylists(next);
    const createdPlaylist = next[0];
    setPlaylistName('My AI Playlist');
    setSelectedSongs([]);
    setError('');
    navigate(`/playlists/${createdPlaylist.id}`);
  };

  const deletePlaylist = (playlistId) => {
    persistPlaylists(savedPlaylists.filter((item) => item.id !== playlistId));
  };

  const RecommendationList = ({ title, songs, emptyLabel }) => (
    <section className="recommendation-list">
      <h3>{title}</h3>
      {songs.length === 0 ? (
        <p className="empty-copy">{emptyLabel}</p>
      ) : (
        songs.map((song) => (
          <article key={`${title}-${song.songId}`} className="recommendation-item">
            <div>
              <p className="song-title">{song.title}</p>
              <p className="song-meta">{song.artist}</p>
              {song.reason && <p className="song-reason">{song.reason}</p>}
            </div>
            <button type="button" className="btn-add" onClick={() => addSongAndFocus(song)}>
              <Plus size={16} />
            </button>
          </article>
        ))
      )}
    </section>
  );

  return (
    <div className="create-playlist-page">
      <header className="create-playlist-header">
        <div className="brand-mark">
          <Music2 size={22} />
          <span>HarmonyHub</span>
        </div>
        <div className="create-header-actions">
          <button className="btn-secondary" onClick={() => navigate('/')}>
            <Home size={16} />
            <span>Home</span>
          </button>
          <button className="btn-secondary" onClick={() => navigate('/playlists')}>
            My Playlists
          </button>
          <button className="btn-secondary" onClick={() => navigate('/party-room')}>
            Party Room
          </button>
        </div>
      </header>

      <main className="create-playlist-grid">
        <section className="generator-panel">
          <h1>Create Playlist With AI</h1>
          <p>Describe your mood, style, and artists. Add recommended songs to build your playlist.</p>

          <form onSubmit={handleGenerate} className="generator-form">
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: upbeat late-night drive tracks with synth-pop and a little indie rock"
            />
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Preferred artist (optional)"
            />
            <input
              type="number"
              min={4}
              max={15}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <button className="btn-primary" type="submit" disabled={loading}>
              <Wand2 size={16} />
              <span>{loading ? 'Generating...' : 'Generate Recommendations'}</span>
            </button>
          </form>

          {error && <p className="error-message">{error}</p>}

          <div className="recommendations-wrapper">
            <RecommendationList
              title="AI Recommendations"
              songs={aiRecommendations}
              emptyLabel="No songs yet. Generate to begin."
            />
            <RecommendationList
              title={regionName ? `${regionName} Picks` : 'Regional Picks'}
              songs={regionalRecommendations}
              emptyLabel="Regional suggestions appear after generation and location capture."
            />
          </div>

          <div className="manual-search-panel">
            <div className="section-title-row">
              <h2>Manual Search</h2>
              <span>Search Spotify and build your own playlist</span>
            </div>

            <form onSubmit={handleSearchSongs} className="manual-search-form">
              <div className="search-input-group">
                <Search size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by song or artist"
                />
                {searchQuery && (
                  <button type="button" className="clear-button" onClick={clearSearch}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <button className="btn-primary" type="submit" disabled={searching}>
                <Search size={16} />
                <span>{searching ? 'Searching...' : 'Search Songs'}</span>
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="manual-search-results">
                {searchResults.map((song) => (
                  <article key={song.songId} className="recommendation-item">
                    <div>
                      <p className="song-title">{song.title}</p>
                      <p className="song-meta">{song.artist}</p>
                      {song.album && <p className="song-reason">{song.album}</p>}
                    </div>
                    <button type="button" className="btn-add" onClick={() => addSongAndFocus(song)}>
                      <Plus size={16} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="playlist-builder-panel">
          <div className="playlist-name-row">
            <input
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="Playlist name"
            />
            <button type="button" className="btn-primary" onClick={savePlaylist}>
              <Save size={16} />
              <span>Save</span>
            </button>
          </div>

          <div className="playlist-hint-box">
            <p>Saved playlists open separately in the library and include a shareable QR code.</p>
          </div>

          <h3>Selected Songs ({selectedSongs.length})</h3>
          <div className="selected-songs-list">
            {selectedSongs.length === 0 && <p className="empty-copy">Add songs from recommendations.</p>}
            {selectedSongs.map((song) => (
              <article key={`selected-${song.songId}`} className="selected-song-item">
                <div>
                  <p className="song-title">{song.title}</p>
                  <p className="song-meta">{song.artist}</p>
                </div>
                <button type="button" onClick={() => removeSong(song.songId)}>
                  <Trash2 size={14} />
                </button>
              </article>
            ))}
          </div>

          <h3>Saved Playlists</h3>
          <div className="saved-playlists-list">
            {savedPlaylists.length === 0 && <p className="empty-copy">No playlists saved yet.</p>}
            {savedPlaylists.map((playlist) => (
              <article key={playlist.id} className="saved-playlist-item">
                <div>
                  <p className="song-title">{playlist.name}</p>
                  <p className="song-meta">{playlist.songs.length} songs</p>
                </div>
                <button type="button" onClick={() => deletePlaylist(playlist.id)}>
                  <Trash2 size={14} />
                </button>
              </article>
            ))}
          </div>

          <div className="playlist-player-panel">
            <div className="section-title-row">
              <h3>Playlist Player</h3>
              <span>{shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}</span>
            </div>

            {currentPlayingSong ? (
              <>
                <div className="playlist-player-now">
                  <p className="song-title">{currentPlayingSong.title}</p>
                  <p className="song-meta">{currentPlayingSong.artist}</p>
                </div>
                {currentPlayingSong.previewUrl ? (
                  <>
                    <audio
                      ref={audioRef}
                      src={currentPlayingSong.previewUrl}
                      onEnded={handleTrackEnded}
                      onTimeUpdate={() => {
                        if (audioRef.current) {
                          setProgressSec(audioRef.current.currentTime || 0);
                          setDurationSec(Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
                        }
                      }}
                      onLoadedMetadata={() => {
                        if (audioRef.current) {
                          setDurationSec(Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
                        }
                      }}
                    />

                    <div className="player-progress-wrap">
                      <span className="player-time">{formatTime(progressSec)}</span>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(durationSec, 1)}
                        step="0.1"
                        value={Math.min(progressSec, durationSec || 0)}
                        onChange={handleSeek}
                        className="player-progress"
                      />
                      <span className="player-time">{formatTime(durationSec)}</span>
                    </div>

                    <div className="player-controls">
                      <button type="button" className="player-btn" onClick={handleShuffleToggle} title="Shuffle">
                        <Shuffle size={18} />
                      </button>
                      <button type="button" className="player-btn" onClick={handlePrevTrack} disabled={currentTrackIndex === 0} title="Previous">
                        <SkipBack size={18} />
                      </button>
                      <button type="button" className="player-btn play-pause" onClick={togglePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
                        {isPlaying ? <Pause size={22} /> : <Play size={22} />}
                      </button>
                      <button type="button" className="player-btn" onClick={handleNextTrack} disabled={currentTrackIndex >= queueOrder.length - 1} title="Next">
                        <SkipForward size={18} />
                      </button>
                      <button type="button" className="player-btn" onClick={handleRepeatToggle} title="Repeat current song">
                        <Repeat size={18} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="preview-unavailable">
                    <p>This track has no browser preview, but it is still part of your playlist.</p>
                  </div>
                )}

                <p className="empty-copy">
                  Playing {currentTrackIndex + 1} of {queueOrder.length}. Songs move one by one with optional shuffle.
                </p>
              </>
            ) : (
              <p className="empty-copy">Add songs to the playlist to enable playback.</p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
