import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './auth/AuthProvider';
import RequireSpotify from './auth/RequireSpotify';
import AppShell from './components/layout/AppShell';
import Home from './pages/Home';
import Login from './pages/Login';
import PartyLobby from './pages/PartyLobby';
import Room from './pages/Room';
import Admin from './pages/Admin';
import CreatePlaylist from './pages/CreatePlaylist';
import PlaylistLibrary from './pages/PlaylistLibrary';
import PlaylistDetail from './pages/PlaylistDetail';
import NotFound from './pages/NotFound';

// Old share links pointed at /playlists/:id.
function LegacyPlaylistRedirect() {
  const { playlistId } = useParams();
  return <Navigate to={`/library/${playlistId}`} replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} />
              <Route path="party" element={<PartyLobby />} />
              <Route path="create" element={<RequireSpotify><CreatePlaylist /></RequireSpotify>} />
              <Route path="library" element={<RequireSpotify><PlaylistLibrary /></RequireSpotify>} />
              <Route path="library/:playlistId" element={<RequireSpotify><PlaylistDetail /></RequireSpotify>} />
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* Party pages use their own focused layout */}
            <Route path="room/:roomId" element={<Room />} />
            <Route path="admin/:roomId" element={<RequireSpotify><Admin /></RequireSpotify>} />

            {/* Paths from earlier versions */}
            <Route path="party-room" element={<Navigate to="/party" replace />} />
            <Route path="create-playlist" element={<Navigate to="/create" replace />} />
            <Route path="playlists" element={<Navigate to="/library" replace />} />
            <Route path="playlists/:playlistId" element={<LegacyPlaylistRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
