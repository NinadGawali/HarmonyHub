// Pure helpers that decide what plays next. Songs are { songId, ... }.

const SPOTIFY_TRACK_ID = /^[A-Za-z0-9]{22}$/;

// Only real Spotify track ids can be played (AI suggestions may carry temporary ids).
export const isPlayableTrack = (song) => Boolean(song && SPOTIFY_TRACK_ID.test(song.songId));

const playable = (songs) => (songs || []).filter(isPlayableTrack);

// Next playable song after `currentId` in list order; the first one when nothing is playing.
export function nextInOrder(songs, currentId) {
  const list = playable(songs);
  if (!currentId) return list[0]?.songId ?? null;
  const index = list.findIndex((song) => song.songId === currentId);
  return index >= 0 ? list[index + 1]?.songId ?? null : list[0]?.songId ?? null;
}

// Previous playable song before `currentId` in list order.
export function previousInOrder(songs, currentId) {
  const list = playable(songs);
  const index = list.findIndex((song) => song.songId === currentId);
  return index > 0 ? list[index - 1].songId : null;
}

// Party mode: the highest-ranked song that has not been played yet.
// `songs` must already be sorted by votes (the leaderboard order).
export function nextByVotes(songs, currentId, playedIds = new Set()) {
  const candidate = playable(songs).find((song) => song.songId !== currentId && !playedIds.has(song.songId));
  return candidate?.songId ?? null;
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
