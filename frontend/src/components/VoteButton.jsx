import React from 'react';
import { ThumbsUp } from 'lucide-react';

export default function VoteButton({ onVote, disabled = false }) {
  return (
    <button
      onClick={onVote}
      disabled={disabled}
      className="vote-button"
      aria-label="Vote for this song"
    >
      <ThumbsUp size={20} />
      <span>Vote</span>
    </button>
  );
}
