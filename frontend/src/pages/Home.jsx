import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Music2, Sparkles, Headphones, Radio, Compass } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  const featuredPlaylists = [
    {
      id: 'night-drive',
      title: 'Night Drive Pulse',
      curator: 'HarmonyHub Editorial',
      poster:
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80'
    },
    {
      id: 'indie-cafe',
      title: 'Indie Cafe Stories',
      curator: 'Top Creators',
      poster:
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80'
    },
    {
      id: 'global-beats',
      title: 'Global Beats Radar',
      curator: 'Regional Trends',
      poster:
        'https://images.unsplash.com/photo-1458560871784-56d23406c091?auto=format&fit=crop&w=900&q=80'
    },
    {
      id: 'sunset-party',
      title: 'Sunset Party Anthems',
      curator: 'Party Rooms',
      poster:
        'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=900&q=80'
    }
  ];

  return (
    <div className="discover-page">
      <header className="discover-nav">
        <div className="brand-mark">
          <Music2 size={24} />
          <span>HarmonyHub</span>
        </div>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/create-playlist">Create Playlist</Link>
          <Link to="/playlists">My Playlists</Link>
          <Link to="/party-room">Party Room</Link>
        </nav>
      </header>

      <section className="discover-hero">
        <div className="room-ambient room-ambient-one"></div>
        <div className="room-ambient room-ambient-two"></div>
        <div className="discover-glow"></div>
        <div className="discover-copy">
          <h1>Build playlists like a streaming pro.</h1>
          <p>
            Describe your vibe, blend favorite artists, and let AI generate tracks for your next
            playlist. Then jump into a party room and crowd-vote songs in real time.
          </p>
          <div className="discover-actions">
            <button className="btn-primary" onClick={() => navigate('/create-playlist')}>
              <Sparkles size={18} />
              <span>Create New Playlist</span>
            </button>
            <button className="btn-secondary" onClick={() => navigate('/playlists')}>
              <Music2 size={18} />
              <span>My Playlists</span>
            </button>
            <button className="btn-secondary" onClick={() => navigate('/party-room')}>
              <Radio size={18} />
              <span>Open Party Room</span>
            </button>
          </div>
        </div>
      </section>

      <section className="top-playlists-section">
        <div className="section-title-row">
          <h2>Top Playlists</h2>
          <span>Fresh posters from trending vibes</span>
        </div>

        <div className="top-playlists-grid">
          {featuredPlaylists.map((playlist) => (
            <article key={playlist.id} className="top-playlist-card">
              <img src={playlist.poster} alt={playlist.title} loading="lazy" />
              <div className="top-playlist-overlay">
                <h3>{playlist.title}</h3>
                <p>{playlist.curator}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="discover-features">
        <article>
          <Headphones size={20} />
          <h3>Curate With AI</h3>
          <p>Type a mood + artist and generate a tracklist you can instantly save.</p>
        </article>
        <article>
          <Compass size={20} />
          <h3>Regional Picks</h3>
          <p>Get an extra playlist with song suggestions influenced by your location.</p>
        </article>
        <article>
          <Radio size={20} />
          <h3>Live Party Rooms</h3>
          <p>Create or join rooms to vote tracks and run your party queue collaboratively.</p>
        </article>
      </section>

      <footer className="discover-footer">
        <p>Built for social playlists, smart recommendations, and party voting.</p>
      </footer>
    </div>
  );
}
