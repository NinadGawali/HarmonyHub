import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Music2, Copy, Shuffle, Wifi, WifiOff } from 'lucide-react';
import SongCard from '../components/SongCard';
import SideSongPlayer from '../components/SideSongPlayer';
import { socket } from '../socket/socket';
import useSpotifyPlayer from '../spotify/hooks/useSpotifyPlayer';
import { getPlaylistUrl, getStoredPlaylists } from '../utils/playlistStorage';

export default function PlaylistDetail() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState([]);
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [connected] = useState(socket.connected);

  const {
    isAuthenticated: spotifyAuthenticated,
    playerReady: spotifyReady,
    deviceId: spotifyDeviceId,
    status: spotifyStatus,
    playbackState,
    error: spotifyError,
    startLogin,
    initializePlayer,
    transferPlaybackHere,
    playTrack,
    pausePlayback,
    resumePlayback,
    seekTo
  } = useSpotifyPlayer({
    playerName: `HarmonyHub Playlist ${playlistId}`
  });

  useEffect(() => {
    setPlaylists(getStoredPlaylists());
  }, []);

  const playlist = useMemo(() => playlists.find((item) => item.id === playlistId), [playlists, playlistId]);

  const ensureSpotifyReady = useCallback(async () => {
    if (!spotifyAuthenticated) {
      await startLogin(`/playlists/${playlistId}`);
      return false;
    }

    if (!spotifyReady) {
      await initializePlayer();
    }

    await transferPlaybackHere(false);
    return true;
  }, [initializePlayer, playlistId, spotifyAuthenticated, spotifyReady, startLogin, transferPlaybackHere]);

  const playSongById = useCallback(async (songId) => {
    if (!songId) {
      return;
    }

    const ready = await ensureSpotifyReady();
    if (!ready) {
      return;
    }

    await playTrack(`spotify:track:${songId}`, 0);
    setSelectedSongId(songId);
  }, [ensureSpotifyReady, playTrack]);

  const handleTogglePlayPause = async () => {
    const ready = await ensureSpotifyReady();
    if (!ready) {
      return;
    }

    if (playbackState?.isPaused) {
      await resumePlayback();
    } else {
      await pausePlayback();
    }
  };

  const handleSeek = async (positionMs) => {
    const ready = await ensureSpotifyReady();
    if (!ready) {
      return;
    }

    await seekTo(positionMs);
  };

  useEffect(() => {
    if (!playlist?.songs?.length) {
      return;
    }

    if (!selectedSongId) {
      setSelectedSongId(playlist.songs[0]?.songId || null);
      return;
    }

    const stillExists = playlist.songs.some((song) => song.songId === selectedSongId);
    if (!stillExists) {
      setSelectedSongId(playlist.songs[0]?.songId || null);
    }
  }, [playlist, selectedSongId]);

  if (!playlist) {
    return (
      <div className="discover-page">
        <div className="empty-library-state">
          <p>Playlist not found.</p>
          <button className="btn-primary" onClick={() => navigate('/playlists')}>
            Back to playlists
          </button>
        </div>
      </div>
    );
  }

  const playlistUrl = getPlaylistUrl(playlist.id);
  const poster = playlist.songs.find((song) => song.image)?.image;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(playlistUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (_error) {
      setCopied(false);
    }
  };

  const handleShufflePick = () => {
    if (!playlist.songs.length) {
      return;
    }

    const randomSong = playlist.songs[Math.floor(Math.random() * playlist.songs.length)];
    playSongById(randomSong.songId);
  };

  return (
    <div className="discover-page playlist-detail-page">
      <header className="discover-nav">
        <div className="brand-mark">
          <Music2 size={24} />
          <span>HarmonyHub</span>
        </div>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/playlists">My Playlists</Link>
          <Link to="/party-room">Party Room</Link>
        </nav>
      </header>

      <section className="library-hero playlist-detail-hero">
        <button className="btn-secondary" onClick={() => navigate('/playlists')}>
          <ArrowLeft size={16} />
          <span>Back to library</span>
        </button>

        <div className="playlist-detail-banner">
          <div className="playlist-detail-poster">
            {poster ? <img src={poster} alt={playlist.name} /> : <Music2 size={48} />}
          </div>
          <div className="playlist-detail-meta">
            <p className="playlist-kicker">Your playlist</p>
            <h1>{playlist.name}</h1>
            <p>{playlist.songs.length} songs ready to play one by one.</p>
            <div className="playlist-detail-actions">
              <button className="btn-primary" onClick={handleShufflePick}>
                <Shuffle size={16} />
                <span>Shuffle play</span>
              </button>
              <button className="btn-secondary" onClick={handleCopyLink}>
                <Copy size={16} />
                <span>{copied ? 'Link copied' : 'Copy link'}</span>
              </button>
            </div>
          </div>
          <div className="playlist-detail-qr">
            <QRCodeSVG value={playlistUrl} size={170} level="H" includeMargin bgColor="#ffffff" fgColor="#000000" />
            <p>Share this QR with others</p>
          </div>
        </div>
      </section>

      <section className="music-player-section">
        <h2 className="player-heading">Playlist Playback</h2>
        <p className="player-subtext">This uses the same client-side Spotify playback flow as joined room users.</p>
        <div className="room-main-grid playlist-playback-grid">
          <div className="room-main-leaderboard playlist-leaderboard-panel">
            <div className="playlist-client-status">
              <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
                {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
                {connected ? 'Connected' : 'Disconnected'}
              </span>
              <span className="playlist-client-note">Client-side playback with Spotify SDK</span>
            </div>

            <div className="playlist-track-grid">
              {playlist.songs.map((song, index) => (
                <SongCard
                  key={song.songId}
                  song={song}
                  rank={index + 1}
                  showVoteButton={false}
                  onSelectSong={() => playSongById(song.songId)}
                  isActive={song.songId === selectedSongId}
                />
              ))}
            </div>
          </div>

          <SideSongPlayer
            songs={playlist.songs}
            selectedSongId={selectedSongId}
            spotifyReady={spotifyReady}
            spotifyAuthenticated={spotifyAuthenticated}
            spotifyStatus={spotifyStatus}
            spotifyDeviceId={spotifyDeviceId}
            spotifyError={spotifyError}
            playbackState={playbackState}
            onConnectSpotify={async () => {
              try {
                await ensureSpotifyReady();
              } catch (_error) {
                // handled by hook state
              }
            }}
            onTogglePlayPause={handleTogglePlayPause}
            onSeek={handleSeek}
            onPrev={() => {
              if (!playlist.songs.length || !selectedSongId) return;
              const currentIndex = playlist.songs.findIndex((song) => song.songId === selectedSongId);
              const previousSong = playlist.songs[currentIndex - 1];
              if (previousSong) {
                playSongById(previousSong.songId);
              }
            }}
            onNext={() => {
              if (!playlist.songs.length || !selectedSongId) return;
              const currentIndex = playlist.songs.findIndex((song) => song.songId === selectedSongId);
              const nextSong = playlist.songs[currentIndex + 1];
              if (nextSong) {
                playSongById(nextSong.songId);
              }
            }}
            canGoPrev={playlist.songs.findIndex((song) => song.songId === selectedSongId) > 0}
            canGoNext={playlist.songs.findIndex((song) => song.songId === selectedSongId) >= 0 && playlist.songs.findIndex((song) => song.songId === selectedSongId) < playlist.songs.length - 1}
            currentIndex={Math.max(playlist.songs.findIndex((song) => song.songId === selectedSongId), 0)}
            totalSongs={playlist.songs.length}
          />
        </div>
      </section>

      <section className="playlist-track-grid">
        {playlist.songs.map((song, index) => (
          <SongCard
            key={song.songId}
            song={song}
            rank={index + 1}
            showVoteButton={false}
            onSelectSong={() => setSelectedSongId(song.songId)}
            isActive={song.songId === selectedSongId}
          />
        ))}
      </section>
    </div>
  );
}
