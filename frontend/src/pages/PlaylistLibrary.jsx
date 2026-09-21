import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Library, Plus, Trash2 } from 'lucide-react';
import { deleteStoredPlaylist, getStoredPlaylists } from '../utils/playlistStorage';
import { useToast } from '../components/Toast';
import { ArtworkMosaic, Button, EmptyState } from '../components/ui';
import styles from './PlaylistLibrary.module.css';

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function PlaylistLibrary() {
  const toast = useToast();
  const [playlists, setPlaylists] = useState(getStoredPlaylists);

  const remove = (playlist) => {
    if (!window.confirm(`Delete "${playlist.name}"? This cannot be undone.`)) return;
    setPlaylists(deleteStoredPlaylist(playlist.id));
    toast.info(`Deleted "${playlist.name}"`);
  };

  return (
    <div className="container">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Your library</h1>
          <p className={styles.subtitle}>
            {playlists.length ? `${playlists.length} ${playlists.length === 1 ? 'playlist' : 'playlists'}` : 'Playlists you create appear here.'}
          </p>
        </div>
        <Button to="/create" icon={Plus}>New playlist</Button>
      </header>

      {playlists.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No playlists yet"
          description="Describe a vibe and let AI build your first one."
          action={<Button to="/create" icon={Plus}>Create a playlist</Button>}
        />
      ) : (
        <ul className={styles.grid}>
          {playlists.map((playlist) => (
            <li key={playlist.id} className={styles.card}>
              <Link to={`/library/${playlist.id}`} className={styles.cardLink}>
                <span className={styles.cover}>
                  <ArtworkMosaic tracks={playlist.songs} seed={playlist.name} size={220} />
                </span>
                <span className={styles.name}>{playlist.name}</span>
                <span className={styles.meta}>
                  {playlist.songs.length} songs · {dateFormat.format(new Date(playlist.createdAt))}
                </span>
              </Link>
              <button type="button" className={styles.delete} onClick={() => remove(playlist)} aria-label={`Delete ${playlist.name}`}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
