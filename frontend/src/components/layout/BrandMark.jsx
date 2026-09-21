import React from 'react';
import { Link } from 'react-router-dom';
import styles from './BrandMark.module.css';

// Logo: three equalizer bars in a rounded tile, plus the wordmark.
export default function BrandMark({ compact = false }) {
  return (
    <Link to="/" className={styles.brand} aria-label="HarmonyHub home">
      <span className={styles.glyph} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact && <span className={styles.word}>HarmonyHub</span>}
    </Link>
  );
}
