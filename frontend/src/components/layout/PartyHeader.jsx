import React from 'react';
import { Badge } from '../ui';
import BrandMark from './BrandMark';
import styles from './PartyHeader.module.css';

// Focused header for room pages: brand, room code, live status and page-specific actions.
export default function PartyHeader({ roomId, connected, votingOpen, role, actions }) {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.identity}>
          <BrandMark compact />
          <div className={styles.room}>
            <span className={styles.label}>{role}</span>
            <span className={styles.code}>{roomId}</span>
          </div>
        </div>

        <div className={styles.status}>
          <Badge tone={connected ? 'success' : 'warning'} dot>{connected ? 'Live' : 'Reconnecting'}</Badge>
          <Badge tone={votingOpen ? 'highlight' : 'neutral'}>{votingOpen ? 'Voting open' : 'Voting closed'}</Badge>
        </div>

        <div className={styles.actions}>{actions}</div>
      </div>
    </header>
  );
}
