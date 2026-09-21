import React, { useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { spotifyAPI } from '../api/api';
import TrackRow from './TrackRow';
import { EmptyState, Spinner, TextInput } from './ui';
import styles from './SpotifySearch.module.css';

/**
 * Search Spotify and add results somewhere (a room, a playlist...).
 * `isAdded(songId)` marks results that are already added.
 */
export default function SpotifySearch({ onAdd, isAdded = () => false, placeholder = 'Search songs or artists' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const search = async (event) => {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;

    setSearching(true);
    setError('');
    try {
      const response = await spotifyAPI.search(text);
      setResults(response.data.songs || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed. Please try again.');
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  const clear = () => {
    setQuery('');
    setResults(null);
    setError('');
  };

  return (
    <div className={styles.search}>
      <form onSubmit={search} role="search">
        <TextInput
          label="Search Spotify"
          hideLabel
          icon={Search}
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          error={error}
          trailing={searching ? <Spinner size={16} /> : query && (
            <button type="button" className={styles.clear} onClick={clear} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        />
      </form>

      {results && results.length === 0 && (
        <EmptyState compact icon={Search} title="No matches" description="Try a different song or artist name." />
      )}

      {results && results.length > 0 && (
        <ul className={styles.results}>
          {results.map((song) => {
            const added = isAdded(song.songId);
            return (
              <TrackRow
                key={song.songId}
                song={song}
                detail={song.album}
                trailing={(
                  <button
                    type="button"
                    className={`${styles.add} ${added ? styles.added : ''}`}
                    onClick={() => onAdd(song)}
                    disabled={added}
                    aria-label={added ? `${song.title} already added` : `Add ${song.title}`}
                  >
                    {added ? <Check size={18} /> : <Plus size={18} />}
                  </button>
                )}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
