import React from 'react';
import styles from './EmptyState.module.css';

export default function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div className={`${styles.empty} ${compact ? styles.compact : ''}`}>
      {Icon && (
        <span className={styles.icon}>
          <Icon size={compact ? 20 : 26} aria-hidden="true" />
        </span>
      )}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
