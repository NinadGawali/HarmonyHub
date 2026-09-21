import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, ListPlus, Plus, Save, Search, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { playlistAPI } from '../api/api';
import { createPlaylistRecord, addStoredPlaylist } from '../utils/playlistStorage';
import TrackRow from '../components/TrackRow';
import SpotifySearch from '../components/SpotifySearch';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, CardHeader, EmptyState, TabPanel, Tabs, TextArea, TextInput } from '../components/ui';
import styles from './CreatePlaylist.module.css';

const TAB_PREFIX = 'create';
const PROMPT_IDEAS = [
  'Late-night drive with synthwave and dream pop',
  'Sunday morning acoustic coffee',
  'High-energy workout hip-hop',
  'Bollywood wedding dance floor',
  'Rainy day lo-fi to focus'
];

function Composer({ onGenerated }) {
  const [prompt, setPrompt] = useState('');
  const [artist, setArtist] = useState('');
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const generate = async (event) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setError('Describe the playlist you want.');
      return;
    }

    setGenerating(true);
    setError('');
    try {
      const { data } = await playlistAPI.generateRecommendations({ description: prompt.trim(), artist: artist.trim(), count });
      onGenerated({ prompt: prompt.trim(), ...data });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate recommendations. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <form className={styles.composer} onSubmit={generate}>
      <TextArea
        label="Describe the vibe"
        placeholder="e.g. upbeat late-night drive with synth-pop and a little indie rock"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        maxLength={500}
        rows={3}
        error={error}
      />
      <div className={styles.ideas} aria-label="Prompt ideas">
        {PROMPT_IDEAS.map((idea) => (
          <button key={idea} type="button" className={styles.idea} onClick={() => setPrompt(idea)}>{idea}</button>
        ))}
      </div>
      <div className={styles.composerRow}>
        <TextInput
          label="Artist to lean on (optional)"
          placeholder="e.g. The Weeknd"
          value={artist}
          onChange={(event) => setArtist(event.target.value)}
          maxLength={100}
        />
        <div className={styles.countField}>
          <label htmlFor="song-count" className={styles.countLabel}>
            Songs <span className={styles.countValue}>{count}</span>
          </label>
          <input
            id="song-count"
            type="range"
            min={4}
            max={15}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className={styles.range}
            style={{ '--fill': `${((count - 4) / 11) * 100}%` }}
          />
        </div>
      </div>
      <Button type="submit" size="lg" icon={Wand2} loading={generating}>
        {generating ? 'Generating...' : 'Generate with AI'}
      </Button>
    </form>
  );
}

function Suggestions({ result, isAdded, onAdd, onAddAll }) {
  const remaining = result.songs.filter((song) => !isAdded(song.songId));

  return (
    <div className={styles.suggestions}>
      <div className={styles.aiMessage}>
        <Sparkles size={18} className={styles.aiIcon} aria-hidden="true" />
        <div>
          <p className={styles.aiPrompt}>&ldquo;{result.prompt}&rdquo;</p>
          <p>{result.message}</p>
          {result.usedFallback && (
            <Badge tone="warning" className={styles.fallbackBadge}>AI unavailable: placeholder suggestions</Badge>
          )}
        </div>
      </div>

      <div className={styles.suggestionsHeader}>
        <span>{result.songs.length} suggestions</span>
        <Button size="sm" variant="secondary" icon={ListPlus} onClick={onAddAll} disabled={!remaining.length}>
          Add all
        </Button>
      </div>

      <ul className={styles.trackList}>
        {result.songs.map((song) => {
          const added = isAdded(song.songId);
          return (
            <TrackRow
              key={song.songId}
              song={song}
              detail={song.reason}
              trailing={(
                <button
                  type="button"
                  className={`${styles.roundButton} ${added ? styles.added : ''}`}
                  onClick={() => onAdd(song)}
                  disabled={added}
                  aria-label={added ? `${song.title} is in your playlist` : `Add ${song.title}`}
                >
                  {added ? <Check size={18} /> : <Plus size={18} />}
                </button>
              )}
            />
          );
        })}
      </ul>
    </div>
  );
}

function PlaylistBuilder({ songs, onRemove, onMove, onSave }) {
  const [name, setName] = useState('');

  const save = (event) => {
    event.preventDefault();
    onSave(name.trim() || 'My playlist');
  };

  return (
    <Card as="aside" className={styles.builder}>
      <CardHeader icon={ListPlus} title="Your playlist" subtitle={`${songs.length} ${songs.length === 1 ? 'song' : 'songs'}`} />
      <form onSubmit={save} className={styles.saveForm}>
        <TextInput label="Playlist name" hideLabel placeholder="Name your playlist" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        <Button type="submit" icon={Save} disabled={!songs.length}>Save</Button>
      </form>

      {songs.length === 0 ? (
        <EmptyState compact icon={ListPlus} title="Empty for now" description="Add songs from AI suggestions or search." />
      ) : (
        <ol className={styles.trackList}>
          {songs.map((song, index) => (
            <TrackRow
              key={song.songId}
              song={song}
              leading={<span className={styles.position}>{index + 1}</span>}
              trailing={(
                <>
                  <button type="button" className={styles.iconButton} onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move ${song.title} up`}>
                    <ArrowUp size={16} />
                  </button>
                  <button type="button" className={styles.iconButton} onClick={() => onMove(index, 1)} disabled={index === songs.length - 1} aria-label={`Move ${song.title} down`}>
                    <ArrowDown size={16} />
                  </button>
                  <button type="button" className={`${styles.iconButton} ${styles.remove}`} onClick={() => onRemove(song.songId)} aria-label={`Remove ${song.title}`}>
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            />
          ))}
        </ol>
      )}
    </Card>
  );
}

export default function CreatePlaylist() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('ai');
  const [result, setResult] = useState(null);
  const [playlist, setPlaylist] = useState([]);

  const isAdded = (songId) => playlist.some((song) => song.songId === songId);
  const addSong = (song) => setPlaylist((current) => (current.some((item) => item.songId === song.songId) ? current : [...current, song]));
  const addAll = () => result.songs.forEach(addSong);
  const removeSong = (songId) => setPlaylist((current) => current.filter((song) => song.songId !== songId));
  const moveSong = (index, direction) => setPlaylist((current) => {
    const next = [...current];
    const target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = (name) => {
    const record = createPlaylistRecord({ name, songs: playlist });
    addStoredPlaylist(record);
    toast.success(`Saved "${name}"`);
    navigate(`/library/${record.id}`);
  };

  return (
    <div className="container">
      <header className={styles.header}>
        <h1 className={styles.title}>Create a playlist</h1>
        <p className={styles.subtitle}>Describe a mood and let AI suggest songs, or search Spotify yourself.</p>
      </header>

      <div className={styles.grid}>
        <Card className={styles.workspace}>
          <Tabs
            idPrefix={TAB_PREFIX}
            label="Ways to add songs"
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'ai', label: 'AI suggestions', icon: Sparkles },
              { id: 'search', label: 'Search Spotify', icon: Search }
            ]}
          />
          {tab === 'ai' ? (
            <TabPanel id="ai" idPrefix={TAB_PREFIX}>
              <Composer onGenerated={setResult} />
              {result && <Suggestions result={result} isAdded={isAdded} onAdd={addSong} onAddAll={addAll} />}
            </TabPanel>
          ) : (
            <TabPanel id="search" idPrefix={TAB_PREFIX}>
              <SpotifySearch onAdd={addSong} isAdded={isAdded} />
            </TabPanel>
          )}
        </Card>

        <PlaylistBuilder songs={playlist} onRemove={removeSong} onMove={moveSong} onSave={save} />
      </div>
    </div>
  );
}
