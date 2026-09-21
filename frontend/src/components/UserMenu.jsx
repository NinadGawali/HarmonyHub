import React from 'react';
import { LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

// Signed-in user chip with logout, or a Spotify login button.
export default function UserMenu() {
  const { user, loading, loginWithSpotify, logout } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <button className="user-menu-login" onClick={() => loginWithSpotify()}>
        <LogIn size={16} />
        <span>Log in with Spotify</span>
      </button>
    );
  }

  return (
    <div className="user-menu">
      {user.avatarUrl ? (
        <img className="user-menu-avatar" src={user.avatarUrl} alt="" />
      ) : (
        <span className="user-menu-avatar user-menu-avatar-fallback"><User size={14} /></span>
      )}
      <span className="user-menu-name">
        {user.displayName}
        {user.isGuest && <span className="user-menu-tag">guest</span>}
      </span>
      <button className="user-menu-logout" onClick={logout} aria-label="Log out" title="Log out">
        <LogOut size={16} />
      </button>
    </div>
  );
}
