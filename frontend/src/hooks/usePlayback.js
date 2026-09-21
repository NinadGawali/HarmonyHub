import { useCallback, useEffect, useRef, useState } from 'react';
import useSpotifyPlayer from '../spotify/hooks/useSpotifyPlayer';
import { isPlayableTrack, nextByVotes, nextInOrder, previousInOrder } from '../utils/queue';

// A track counts as finished when the SDK reports paused at 0 right after being near the end.
const END_OF_TRACK_WINDOW_MS = 4000;

/**
 * Shared Spotify playback for a list of songs.
 * mode: 'ordered' plays the list top to bottom; 'votes' always plays the highest-voted unplayed song.
 */
export default function usePlayback({ songs, playerName, returnPath, mode = 'ordered', autoAdvance = true }) {
  const spotify = useSpotifyPlayer({ playerName });
  const {
    isAuthenticated, playerReady, playbackState, startLogin, initializePlayer,
    transferPlaybackHere, playTrack, pausePlayback, resumePlayback, seekTo
  } = spotify;

  const [currentId, setCurrentId] = useState(null);
  const [playedIds, setPlayedIds] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const lastStateRef = useRef(null);
  const advancingRef = useRef(false);

  const currentTrack = songs.find((song) => song.songId === currentId) || null;

  const ensureReady = useCallback(async () => {
    if (!isAuthenticated) {
      await startLogin(returnPath || window.location.pathname);
      return false;
    }
    if (!playerReady) {
      await initializePlayer();
      await transferPlaybackHere(false);
    }
    return true;
  }, [initializePlayer, isAuthenticated, playerReady, returnPath, startLogin, transferPlaybackHere]);

  const play = useCallback(async (songId) => {
    const song = songs.find((item) => item.songId === songId);
    if (!isPlayableTrack(song)) {
      setError('This track is not available on Spotify.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      if (!(await ensureReady())) return;
      await playTrack(`spotify:track:${songId}`, 0);
      setCurrentId(songId);
      setPlayedIds((previous) => new Set(previous).add(songId));
    } catch (playError) {
      setError(playError.message || 'Could not start playback');
    } finally {
      setBusy(false);
    }
  }, [ensureReady, playTrack, songs]);

  const nextId = mode === 'votes'
    ? nextByVotes(songs, currentId, playedIds)
    : nextInOrder(songs, currentId);
  const previousId = mode === 'votes' ? null : previousInOrder(songs, currentId);

  const next = useCallback(() => (nextId ? play(nextId) : undefined), [nextId, play]);
  const previous = useCallback(() => (previousId ? play(previousId) : undefined), [previousId, play]);

  const toggle = useCallback(async () => {
    if (!currentId) {
      if (nextId) await play(nextId);
      return;
    }

    setError('');
    try {
      if (!(await ensureReady())) return;
      if (playbackState?.isPaused) {
        await resumePlayback();
      } else {
        await pausePlayback();
      }
    } catch (toggleError) {
      setError(toggleError.message || 'Playback control failed');
    }
  }, [currentId, ensureReady, nextId, pausePlayback, play, playbackState?.isPaused, resumePlayback]);

  const seek = useCallback(async (positionMs) => {
    try {
      await seekTo(positionMs);
    } catch (seekError) {
      setError(seekError.message || 'Seek failed');
    }
  }, [seekTo]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      await ensureReady();
    } catch (connectError) {
      setError(connectError.message || 'Could not connect to Spotify');
    } finally {
      setBusy(false);
    }
  }, [ensureReady]);

  // Auto-advance when the current track ends. SDK updates are sparse, so the previous
  // state's position is extrapolated to "now" before comparing it with the duration.
  useEffect(() => {
    if (!playbackState || !currentId) return;

    const previousState = lastStateRef.current;
    // The effect also re-runs when the queue changes; only react to new player states.
    if (previousState === playbackState) return;
    lastStateRef.current = playbackState;
    if (!previousState) return;

    const expectedPosition = previousState.isPaused
      ? previousState.positionMs
      : previousState.positionMs + (playbackState.updatedAt - previousState.updatedAt);
    const { isPaused, positionMs, durationMs } = playbackState;
    const endedNaturally = isPaused
      && positionMs === 0
      && durationMs > 0
      && expectedPosition >= durationMs - END_OF_TRACK_WINDOW_MS;

    if (autoAdvance && endedNaturally && nextId && !advancingRef.current) {
      advancingRef.current = true;
      play(nextId).finally(() => { advancingRef.current = false; });
    }
  }, [autoAdvance, currentId, nextId, play, playbackState]);

  return {
    currentTrack,
    currentId,
    playbackState,
    isAuthenticated,
    playerReady,
    status: spotify.status,
    busy,
    error: error || spotify.error,
    canNext: Boolean(nextId),
    canPrevious: Boolean(previousId),
    play,
    toggle,
    next,
    previous,
    seek,
    connect
  };
}
