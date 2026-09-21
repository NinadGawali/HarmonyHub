import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Check, Link2, ListMusic, Play, Shuffle } from 'lucide-react';
import usePlayback from '../hooks/usePlayback';
import TrackRow from '../components/TrackRow';
import PlayerBar from '../components/PlayerBar';
import { getPlaylistUrl, getStoredPlaylists } from '../utils/playlistStorage';
import { isPlayableTrack } from '../utils/queue';
import { ArtworkMosaic, Button, EmptyState } from '../components/ui';
import styles from './PlaylistDetail.module.css';

function PlaylistView({ playlist }) {
  const [copied, setCopied] = useState(false);
  const playback = usePlayback({
    songs: playlist.songs,
    playerName: `HarmonyHub · ${playlist.name}`,
    returnPath: `/library/${playlist.id}`
  });
  const playable = playlist.songs.filter(isPlayableTrack);

  const shuffle = () => {
    const pick = playable[Math.floor(Math.random() * playable.length)];
    if (pick) playback.play(pick.songId);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getPlaylistUrl(playlist.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="container">
      <Button to="/library" variant="ghost" size="sm" icon={ArrowLeft} className={styles.back}>Library</Button>

      <header className={styles.hero}>
        <ArtworkMosaic tracks={playlist.songs} seed={playlist.name} size={200} />
        <div className={styles.heroText}>
          <span className={styles.kicker}>Playlist</span>
          <h1 className={styles.title}>{playlist.name}</h1>
          <p className={styles.meta}>
            {playlist.songs.length} songs
            {playable.length < playlist.songs.length && ` · ${playlist.songs.length - playable.length} not on Spotify`}
          </p>
          <div className={styles.actions}>
            <Button size="lg" icon={Play} onClick={() => playable[0] && playback.play(playable[0].songId)} disabled={!playable.length}>
              Play
            </Button>
            <Button size="lg" variant="secondary" icon={Shuffle} onClick={shuffle} disabled={!playable.length}>Shuffle</Button>
            <Button size="lg" variant="ghost" icon={copied ? Check : Link2} onClick={copyLink}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      </header>

      <ol className={styles.tracks}>
        {playlist.songs.map((song, index) => {
          const canPlay = isPlayableTrack(song);
          return (
            <TrackRow
              key={song.songId}
              song={song}
              detail={canPlay ? song.album : 'AI suggestion, not matched to Spotify yet'}
              active={song.songId === playback.currentId}
              onSelect={canPlay ? () => playback.play(song.songId) : undefined}
              leading={<span className={styles.position}>{index + 1}</span>}
            />
          );
        })}
      </ol>

      <PlayerBar playback={playback} label="Playing from this playlist" />
    </div>
  );
}

export default function PlaylistDetail() {
  const { playlistId } = useParams();
  const playlist = useMemo(() => getStoredPlaylists().find((item) => item.id === playlistId), [playlistId]);

  if (!playlist) {
    return (
      <div className="container">
        <EmptyState
          icon={ListMusic}
          title="Playlist not found"
          description="Playlists are saved in the browser where they were created."
          action={<Button to="/library" variant="secondary">Back to library</Button>}
        />
      </div>
    );
  }

  return <PlaylistView playlist={playlist} />;
}
