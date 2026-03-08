import React from 'react';
import SongCard from './SongCard';
import { Trophy, Music2 } from 'lucide-react';

export default function Leaderboard({ songs, onVote, showVoteButton = true, isAdmin = false, onRemove, votedSongs }) {
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
        <h2>Leaderboard</h2>
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
          />
        ))}
      </div>
    </div>
  );
}
