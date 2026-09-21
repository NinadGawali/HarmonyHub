import React from 'react';
import styles from './Badge.module.css';

// Small status pill. tone: neutral | accent | highlight | success | warning | danger
export default function Badge({ tone = 'neutral', icon: Icon, dot = false, children, className = '' }) {
  return (
    <span className={`${styles.badge} ${styles[tone]} ${className}`}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {Icon && <Icon size={14} aria-hidden="true" />}
      {children}
    </span>
  );
}
