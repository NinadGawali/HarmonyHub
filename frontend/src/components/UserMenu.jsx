import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Artwork, Button } from './ui';
import styles from './UserMenu.module.css';

// Signed-in user chip with logout, or a Spotify login button.
export default function UserMenu() {
  const { user, loading, loginWithSpotify, logout } = useAuth();

  if (loading) {
    return <span className={styles.placeholder} aria-hidden="true" />;
  }

  if (!user) {
    return (
      <Button variant="secondary" size="sm" onClick={() => loginWithSpotify()}>
        Log in
      </Button>
    );
  }

  return (
    <div className={styles.menu}>
      <Artwork src={user.avatarUrl} seed={user.displayName} size={28} radius="lg" className={styles.avatar} />
      <span className={styles.name} title={user.displayName}>{user.displayName}</span>
      {user.isGuest && <span className={styles.tag}>guest</span>}
      <button type="button" className={styles.logout} onClick={logout} aria-label="Log out" title="Log out">
        <LogOut size={16} />
      </button>
    </div>
  );
}
