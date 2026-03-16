import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Room APIs
export const roomAPI = {
  create: (adminName) => api.post('/rooms', { adminName }),
  get: (roomId) => api.get(`/rooms/${roomId}`),
  join: (roomId, userName) => api.post(`/rooms/${roomId}/join`, { userName }),
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
};

export default api;
