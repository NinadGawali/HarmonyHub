import React from 'react';
import VoteButton from './VoteButton';
import { Music, ExternalLink } from 'lucide-react';

export default function SongCard({
  song,
  rank,
  onVote,
  showVoteButton = true,
  isAdmin = false,
  onRemove,
  votedSongs = new Set(),
  onSelectSong,
  isActive = false
}) {
  const hasVoted = votedSongs.has(song.songId);
  const isSelectable = Boolean(onSelectSong && song?.songId);

  const handleCardClick = () => {
    if (isSelectable) {
      onSelectSong(song);
    }
  };
  
  return (
    <div
      className={`song-card ${isSelectable ? 'song-card-selectable' : ''} ${isActive ? 'song-card-active' : ''}`}
      onClick={handleCardClick}
      role={isSelectable ? 'button' : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      onKeyDown={(event) => {
        if (isSelectable && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          handleCardClick();
        }
      }}
    >
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
              onClick={(event) => event.stopPropagation()}
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
            <VoteButton
              onVote={(event) => {
                event.stopPropagation();
                onVote(song.songId);
              }}
            />
          )
        )}
        {isAdmin && onRemove && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onRemove(song.songId);
            }}
            className="remove-button"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
