import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PartyRoom from './pages/PartyRoom';
import CreatePlaylist from './pages/CreatePlaylist';
import PlaylistLibrary from './pages/PlaylistLibrary';
import PlaylistDetail from './pages/PlaylistDetail';
import Room from './pages/Room';
import Admin from './pages/Admin';
import SpotifyCallback from './pages/SpotifyCallback';
import LocationTracker from './components/LocationTracker';
import './styles/App.css';

function App() {
  return (
    <Router>
      <LocationTracker />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/party-room" element={<PartyRoom />} />
        <Route path="/create-playlist" element={<CreatePlaylist />} />
        <Route path="/playlists" element={<PlaylistLibrary />} />
        <Route path="/playlists/:playlistId" element={<PlaylistDetail />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/admin/:roomId" element={<Admin />} />
        <Route path="/spotify/callback" element={<SpotifyCallback />} />
      </Routes>
    </Router>
  );
}

export default App;
