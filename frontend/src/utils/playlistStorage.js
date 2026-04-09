const PLAYLIST_STORAGE_KEY = 'harmonyhub.playlists';

export const getStoredPlaylists = () => {
  try {
    const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_error) {
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

export const getPlaylistUrl = (playlistId) => `${window.location.origin}/playlists/${playlistId}`;
