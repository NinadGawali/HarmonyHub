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

// Spotify APIs
export const spotifyAPI = {
  search: (query) => api.get('/spotify/search', { params: { q: query } }),
};

// Playlist APIs
export const playlistAPI = {
  generateRecommendations: (payload) => api.post('/playlists/recommendations', payload),
};

export default api;
