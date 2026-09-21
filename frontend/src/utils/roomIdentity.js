// Per-room guest identity, kept in sessionStorage so a page refresh keeps the same
// user id (and therefore the same votes). Replaced by server sessions in a later phase.
const storageKey = (roomId) => `harmonyhub.room.${roomId}.identity`;

export function loadRoomIdentity(roomId) {
  try {
    const raw = sessionStorage.getItem(storageKey(roomId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.userId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRoomIdentity(roomId, identity) {
  try {
    sessionStorage.setItem(storageKey(roomId), JSON.stringify(identity));
  } catch {
    // Storage can be unavailable (private mode); the identity then lasts for this page view only.
  }
  return identity;
}

// Use the stored identity, else the one handed over by the join page, else a fresh guest id.
export function resolveRoomIdentity(roomId, handedOver) {
  const stored = loadRoomIdentity(roomId);
  if (stored) {
    return stored;
  }

  const userName = handedOver?.userName?.trim() || 'Guest';
  const userId = handedOver?.userId || `${userName}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return saveRoomIdentity(roomId, { userId, userName });
}
