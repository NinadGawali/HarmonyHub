import React from 'react';
import VoteButton from './VoteButton';
import { Music, ExternalLink } from 'lucide-react';

export default function SongCard({ song, rank, onVote, showVoteButton = true, isAdmin = false, onRemove, votedSongs = new Set() }) {
  const hasVoted = votedSongs.has(song.songId);
  
  return (
    <div className="song-card">
      <div className="song-card-rank">
        {rank <= 3 ? (
          <span className={`rank-badge rank-${rank}`}>#{rank}</span>
        ) : (
          <span className="rank-number">#{rank}</span>
        )}
      </div>

      <div className="song-card-image">
        {song.image ? (
          <img src={song.image} alt={song.title} />
        ) : (
          <div className="song-card-placeholder">
            <Music size={40} />
          </div>
        )}
      </div>

      <div className="song-card-content">
        <h3 className="song-title">{song.title}</h3>
        <p className="song-artist">{song.artist}</p>
        <div className="song-meta">
          <span className="song-votes">{song.votes || 0} votes</span>
          {song.spotifyUrl && (
            <a
              href={song.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="spotify-link"
            >
              <ExternalLink size={16} />
              <span>Spotify</span>
            </a>
          )}
        </div>
      </div>

      <div className="song-card-actions">
        {showVoteButton && !isAdmin && (
          hasVoted ? (
            <button className="vote-button voted" disabled>
              ✓ Voted
            </button>
          ) : (
            <VoteButton onVote={() => onVote(song.songId)} />
          )
        )}
        {isAdmin && onRemove && (
          <button
            onClick={() => onRemove(song.songId)}
            className="remove-button"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
