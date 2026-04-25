import React from 'react';
import SongCard from './SongCard';
import { Trophy, Music2 } from 'lucide-react';

export default function Leaderboard({
  songs,
  onVote,
  showVoteButton = true,
  isAdmin = false,
  onRemove,
  votedSongs,
  onSongSelect,
  activeSongId
}) {
  if (!songs || songs.length === 0) {
    return (
      <div className="empty-state">
        <Music2 size={64} />
        <h3>No songs yet</h3>
        <p>Add some songs to get started!</p>
      </div>
    );
  }

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <Trophy size={32} />
        <div>
          <h2>Leaderboard</h2>
          <p className="leaderboard-subtitle">Live ordering with depth, glow, and quick actions.</p>
        </div>
      </div>

      <div className="leaderboard-list">
        {songs.map((song, index) => (
          <SongCard
            key={song.songId}
            song={song}
            rank={index + 1}
            onVote={onVote}
            showVoteButton={showVoteButton}
            isAdmin={isAdmin}
            onRemove={onRemove}
            votedSongs={votedSongs}
            onSelectSong={onSongSelect}
            isActive={activeSongId === song.songId}
          />
        ))}
      </div>
    </div>
  );
}
