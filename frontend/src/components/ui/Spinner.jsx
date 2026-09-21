import React from 'react';
import styles from './Spinner.module.css';

export default function Spinner({ size = 20, label }) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    />
  );
}

// Centered spinner for full-page loading states.
export function PageSpinner({ label = 'Loading' }) {
  return (
    <div className={styles.page}>
      <Spinner size={32} label={label} />
    </div>
  );
}
