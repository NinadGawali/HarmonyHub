import React, { useState } from 'react';
import { ExternalLink, ListPlus, RefreshCw } from 'lucide-react';
import { authAPI, playlistAPI } from '../api/api';
import { isPlayableTrack } from '../utils/queue';
import { useToast } from './Toast';
import { Button } from './ui';

const RECONNECT_CODES = new Set(['SPOTIFY_RECONNECT', 'SPOTIFY_LOGIN_REQUIRED']);

/**
 * Saves `songs` as a private playlist in the user's Spotify account.
 * After saving, the button turns into an "Open in Spotify" link.
 * `returnPath` is where the user lands again if they have to reconnect Spotify.
 */
export default function SaveToSpotify({ name, description, songs, returnPath, size = 'md', variant = 'secondary' }) {
  const toast = useToast();
  const [state, setState] = useState({ status: 'idle', url: '' });
  const trackIds = (songs || []).filter(isPlayableTrack).map((song) => song.songId);

  if (state.status === 'saved') {
    return (
      <Button size={size} variant={variant} icon={ExternalLink} href={state.url} target="_blank" rel="noopener noreferrer">
        Open in Spotify
      </Button>
    );
  }

  if (state.status === 'reconnect') {
    return (
      <Button size={size} variant="spotify" icon={RefreshCw} href={authAPI.spotifyLoginUrl(returnPath)}>
        Reconnect Spotify
      </Button>
    );
  }

  const save = async () => {
    setState({ status: 'saving', url: '' });
    try {
      const { data } = await playlistAPI.exportToSpotify({ name, description, trackIds });
      setState({ status: 'saved', url: data.url });
      toast.success(`Saved "${data.name}" to your Spotify`);
    } catch (error) {
      const { code, error: message } = error.response?.data || {};
      if (RECONNECT_CODES.has(code)) {
        setState({ status: 'reconnect', url: '' });
        toast.info(message || 'Reconnect Spotify to save playlists.');
        return;
      }
      setState({ status: 'idle', url: '' });
      toast.error(message || 'Could not save to Spotify.');
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      icon={ListPlus}
      onClick={save}
      loading={state.status === 'saving'}
      disabled={!trackIds.length}
      title={trackIds.length ? undefined : 'No Spotify songs to save yet'}
    >
      Save to Spotify
    </Button>
  );
}
