import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI } from '../api/api';
import { socket } from '../socket/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await authAPI.me();
      setUser(response.data.user);
      return response.data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Full-page navigation: the backend redirects to Spotify and back to `returnTo`.
  const loginWithSpotify = useCallback((returnTo = window.location.pathname + window.location.search) => {
    window.location.assign(authAPI.spotifyLoginUrl(returnTo));
  }, []);

  const joinAsGuest = useCallback(async (displayName) => {
    const response = await authAPI.joinAsGuest(displayName);
    // The socket authenticates at connect time; reconnect it with the new session.
    socket.disconnect();
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } finally {
      socket.disconnect();
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isSpotifyUser: Boolean(user && !user.isGuest),
    refresh,
    loginWithSpotify,
    joinAsGuest,
    logout
  }), [user, loading, refresh, loginWithSpotify, joinAsGuest, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
