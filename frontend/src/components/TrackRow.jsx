import React, { forwardRef } from 'react';
import { AudioLines } from 'lucide-react';
import { Artwork } from './ui';
import styles from './TrackRow.module.css';

/**
 * One song in a list. The artwork+title area becomes a button when `onSelect` is given;
 * actions go in `trailing` so they are never nested inside that button.
 */
const TrackRow = forwardRef(function TrackRow({
  song,
  leading,
  trailing,
  detail,
  active = false,
  onSelect,
  selectLabel,
  className = '',
  children
}, ref) {
  const body = (
    <>
      <span className={styles.artWrap}>
        <Artwork src={song.image} alt="" seed={`${song.title}${song.artist}`} size={48} />
        {active && (
          <span className={styles.nowPlaying} aria-hidden="true">
            <AudioLines size={18} />
          </span>
        )}
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{song.title}</span>
        <span className={styles.artist}>{song.artist}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
      </span>
    </>
  );

  return (
    <li ref={ref} className={`${styles.row} ${active ? styles.active : ''} ${className}`}>
      {leading && <span className={styles.leading}>{leading}</span>}
      {onSelect ? (
        <button
          type="button"
          className={`${styles.main} ${styles.selectable}`}
          onClick={() => onSelect(song)}
          aria-label={selectLabel || `Play ${song.title} by ${song.artist}`}
          aria-current={active || undefined}
        >
          {body}
        </button>
      ) : (
        <span className={styles.main}>{body}</span>
      )}
      {children}
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </li>
  );
});

export default TrackRow;
