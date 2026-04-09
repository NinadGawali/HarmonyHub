import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Music2, ArrowLeft, Play, Plus } from 'lucide-react';
import { getStoredPlaylists } from '../utils/playlistStorage';

const fallbackPoster = 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80';

export default function PlaylistLibrary() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState([]);

  useEffect(() => {
    setPlaylists(getStoredPlaylists());
  }, []);

  return (
    <div className="discover-page playlist-library-page">
      <header className="discover-nav">
        <div className="brand-mark">
          <Music2 size={24} />
          <span>HarmonyHub</span>
        </div>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/create-playlist">Create Playlist</Link>
          <Link to="/party-room">Party Room</Link>
        </nav>
      </header>

      <section className="library-hero">
        <button className="btn-secondary" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div>
          <h1>My Playlists</h1>
          <p>Open, play, and share each playlist separately.</p>
        </div>
      </section>

      {playlists.length === 0 ? (
        <div className="empty-library-state">
          <Plus size={28} />
          <p>No playlists saved yet.</p>
          <button className="btn-primary" onClick={() => navigate('/create-playlist')}>
            Create your first playlist
          </button>
        </div>
      ) : (
        <div className="top-playlists-grid">
          {playlists.map((playlist) => {
            const poster = playlist.songs?.find((song) => song.image)?.image || fallbackPoster;
            return (
              <article key={playlist.id} className="top-playlist-card library-playlist-card">
                <img src={poster} alt={playlist.name} loading="lazy" />
                <div className="top-playlist-overlay">
                  <h3>{playlist.name}</h3>
                  <p>{playlist.songs.length} songs</p>
                  <button className="library-open-btn" onClick={() => navigate(`/playlists/${playlist.id}`)}>
                    <Play size={14} />
                    <span>Open playlist</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
