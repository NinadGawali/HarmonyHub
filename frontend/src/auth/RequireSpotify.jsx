import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { PageSpinner } from '../components/ui';

// Renders children only for users signed in with Spotify; everyone else goes to /login.
export default function RequireSpotify({ children }) {
  const { loading, isSpotifyUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageSpinner />;
  }

  if (!isSpotifyUser) {
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return children;
}
