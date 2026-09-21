// Playlists are kept in this browser until they move to the server in a later phase.
const PLAYLIST_STORAGE_KEY = 'harmonyhub.playlists';

export const getStoredPlaylists = () => {
  try {
    const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveStoredPlaylists = (playlists) => {
  localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(playlists));
  return playlists;
};

export const createPlaylistRecord = ({ name, songs }) => ({
  id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  name,
  createdAt: new Date().toISOString(),
  songs
});

export const addStoredPlaylist = (playlist) => saveStoredPlaylists([playlist, ...getStoredPlaylists()]);

export const deleteStoredPlaylist = (playlistId) =>
  saveStoredPlaylists(getStoredPlaylists().filter((playlist) => playlist.id !== playlistId));

export const getPlaylistUrl = (playlistId) => `${window.location.origin}/library/${playlistId}`;
