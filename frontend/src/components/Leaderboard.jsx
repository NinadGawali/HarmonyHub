import React, { useLayoutEffect, useRef } from 'react';
import { Check, ChevronUp, ListMusic, Trash2 } from 'lucide-react';
import TrackRow from './TrackRow';
import { EmptyState, Spinner } from './ui';
import styles from './Leaderboard.module.css';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// FLIP: when the order changes, animate each row from its old position to its new one.
function useReorderAnimation(order) {
  const rows = useRef(new Map());
  const positions = useRef(new Map());
  const refCallbacks = useRef(new Map());

  useLayoutEffect(() => {
    const animate = !prefersReducedMotion();
    const nextPositions = new Map();

    rows.current.forEach((node, id) => {
      const top = node.offsetTop; // unaffected by page scroll and by running transforms
      const previousTop = positions.current.get(id);
      if (animate && previousTop !== undefined && previousTop !== top) {
        node.animate(
          [{ transform: `translateY(${previousTop - top}px)` }, { transform: 'translateY(0)' }],
          { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
      }
      nextPositions.set(id, top);
    });

    positions.current = nextPositions;
  }, [order]);

  // One stable ref callback per row, so React does not detach and re-attach rows on every render.
  return (id) => {
    if (!refCallbacks.current.has(id)) {
      refCallbacks.current.set(id, (node) => {
        if (node) rows.current.set(id, node);
        else rows.current.delete(id);
      });
    }
    return refCallbacks.current.get(id);
  };
}

function RankBadge({ rank }) {
  const podium = rank <= 3 ? styles[`rank${rank}`] : '';
  return <span className={`${styles.rank} ${podium}`}>{rank}</span>;
}

/**
 * Live, vote-ordered song list.
 * Guests get vote buttons (onVote); hosts get remove buttons (onRemove).
 */
export default function Leaderboard({
  songs,
  votedIds = new Set(),
  pendingIds = new Set(),
  votingOpen = true,
  currentId,
  onVote,
  onRemove,
  onSelect,
  emptyAction
}) {
  const order = songs.map((song) => song.songId).join('|');
  const rowRef = useReorderAnimation(order);
  const maxVotes = Math.max(1, ...songs.map((song) => song.votes || 0));

  if (!songs.length) {
    return (
      <EmptyState
        icon={ListMusic}
        title="No songs yet"
        description={onRemove ? 'Search Spotify or approve a request to add the first song.' : 'The host has not added songs yet. You can request one.'}
        action={emptyAction}
      />
    );
  }

  return (
    <ol className={styles.list} aria-live="polite">
      {songs.map((song, index) => {
        const voted = votedIds.has(song.songId);
        const pending = pendingIds.has(song.songId);
        const votes = song.votes || 0;

        return (
          <TrackRow
            key={song.songId}
            ref={rowRef(song.songId)}
            song={song}
            active={song.songId === currentId}
            onSelect={onSelect}
            leading={<RankBadge rank={index + 1} />}
            trailing={(
              <>
                <span className={styles.votes} aria-label={`${votes} ${votes === 1 ? 'vote' : 'votes'}`}>
                  {votes}
                </span>
                {onVote && (
                  <button
                    type="button"
                    className={`${styles.voteButton} ${voted ? styles.voted : ''}`}
                    onClick={() => onVote(song.songId)}
                    disabled={voted || pending || !votingOpen}
                    aria-pressed={voted}
                    aria-label={voted ? `You voted for ${song.title}` : `Vote for ${song.title}`}
                  >
                    {pending ? <Spinner size={16} /> : voted ? <Check size={18} /> : <ChevronUp size={20} />}
                  </button>
                )}
                {onRemove && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => onRemove(song.songId)}
                    aria-label={`Remove ${song.title}`}
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </>
            )}
          >
            <span className={styles.meter} aria-hidden="true" style={{ '--share': `${(votes / maxVotes) * 100}%` }} />
          </TrackRow>
        );
      })}
    </ol>
  );
}
