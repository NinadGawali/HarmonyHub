import axios from 'axios';

// Same-origin API (proxied to the backend by Vite in dev and nginx in containers).
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth APIs
export const authAPI = {
  me: () => api.get('/auth/me'),
  joinAsGuest: (displayName) => api.post('/auth/guest', { displayName }),
  logout: () => api.post('/auth/logout'),
  getSpotifyToken: () => api.get('/auth/spotify/token'),
  spotifyLoginUrl: (returnTo = '/') => `/api/auth/spotify/login?returnTo=${encodeURIComponent(returnTo)}`,
};

// Room APIs
export const roomAPI = {
  create: () => api.post('/rooms'),
  get: (roomId) => api.get(`/rooms/${roomId}`),
  join: (roomId) => api.post(`/rooms/${roomId}/join`),
  delete: (roomId) => api.delete(`/rooms/${roomId}`),
};

// Song APIs
export const songAPI = {
  getLeaderboard: (roomId) => api.get(`/rooms/${roomId}/leaderboard`),
  addSong: (roomId, songData) => api.post(`/rooms/${roomId}/songs`, songData),
  removeSong: (roomId, songId) => api.delete(`/rooms/${roomId}/songs/${songId}`),
};

// Spotify APIs
export const spotifyAPI = {
  search: (query) => api.get('/spotify/search', { params: { q: query } }),
  getTrack: (trackId) => api.get(`/spotify/track/${trackId}`),
};

// Location APIs
export const locationAPI = {
  send: (locationData) => api.post('/location', locationData),
  getLatest: () => api.get('/location/latest'),
};

// Playlist APIs
export const playlistAPI = {
  generateRecommendations: (payload) => api.post('/playlists/recommendations', payload),
  generateAIRecommendations: (payload) => api.post('/playlists/recommendations/ai', payload),
  generateLocationRecommendations: (payload) => api.post('/playlists/recommendations/location', payload),
};

export default api;
