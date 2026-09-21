import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import PartyRoom from './pages/PartyRoom';
import CreatePlaylist from './pages/CreatePlaylist';
import PlaylistLibrary from './pages/PlaylistLibrary';
import PlaylistDetail from './pages/PlaylistDetail';
import Room from './pages/Room';
import Admin from './pages/Admin';
import LocationTracker from './components/LocationTracker';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './auth/AuthProvider';
import RequireSpotify from './auth/RequireSpotify';
import './styles/App.css';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <LocationTracker />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/party-room" element={<PartyRoom />} />
            <Route path="/room/:roomId" element={<Room />} />
            <Route path="/admin/:roomId" element={<RequireSpotify><Admin /></RequireSpotify>} />
            <Route path="/create-playlist" element={<RequireSpotify><CreatePlaylist /></RequireSpotify>} />
            <Route path="/playlists" element={<RequireSpotify><PlaylistLibrary /></RequireSpotify>} />
            <Route path="/playlists/:playlistId" element={<RequireSpotify><PlaylistDetail /></RequireSpotify>} />
          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
