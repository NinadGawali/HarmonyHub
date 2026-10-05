// Party rooms: Postgres is the source of truth; Redis only caches each room's
// leaderboard as a sorted set (rebuilt from Postgres whenever it is missing).
const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/db');
const { redis } = require('../config/redis');
const { config } = require('../config/env');
const { generateRoomCode } = require('../utils/generateRoomCode');
const { searchSongs, getTrackDetails } = require('./spotifyService');

const MAX_CODE_ATTEMPTS = 5;

class RoomNotFoundError extends Error {
  constructor(roomId) {
    super(`Room ${roomId} not found or expired`);
    this.name = 'RoomNotFoundError';
  }
}

class VoteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VoteError';
    this.code = code;
  }
}

// Expected, user-facing request problems (not found, already handled, no Spotify match).
class RequestError extends Error {}

const isUniqueViolation = (error) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const leaderboardKey = (roomId) => `leaderboard:${roomId}`;

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

const activeRoomWhere = (roomId) => ({ id: roomId, status: 'ACTIVE', expiresAt: { gt: new Date() } });

const getRoom = (roomId) => prisma.room.findFirst({ where: activeRoomWhere(roomId) });

const requireRoom = async (roomId) => {
  const room = roomId ? await getRoom(roomId) : null;
  if (!room) throw new RoomNotFoundError(roomId);
  return room;
};

const roomExists = async (roomId) => Boolean(roomId && (await getRoom(roomId)));

const createRoom = async (host) => {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.room.create({
        data: {
          id: generateRoomCode(),
          hostUserId: host.id,
          expiresAt: new Date(Date.now() + config.roomTtlSeconds * 1000),
          members: { create: { userId: host.id } }
        }
      });
    } catch (error) {
      // Room codes are primary keys, including those of ended rooms; try another code.
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error('Could not allocate a room code');
};

const isRoomHost = async (roomId, userId) => {
  const room = await getRoom(roomId);
  return Boolean(room && userId && room.hostUserId === userId);
};

const addRoomMember = (roomId, userId) => prisma.roomMember.upsert({
  where: { roomId_userId: { roomId, userId } },
  create: { roomId, userId },
  update: {}
});

const countMembers = (roomId) => prisma.roomMember.count({ where: { roomId } });

const setVotingStatus = async (roomId, isOpen) => {
  const { count } = await prisma.room.updateMany({ where: activeRoomWhere(roomId), data: { votingOpen: isOpen } });
  if (!count) throw new RoomNotFoundError(roomId);
};

const getVotingStatus = async (roomId) => (await requireRoom(roomId)).votingOpen;

const deleteRoom = async (roomId) => {
  await prisma.room.deleteMany({ where: { id: roomId } });
  await redis.del(leaderboardKey(roomId));
};

// Marks rooms past their expiry as ENDED. Returns how many were ended.
const endExpiredRooms = async () => {
  const { count } = await prisma.room.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lte: new Date() } },
    data: { status: 'ENDED' }
  });
  return count;
};

// ---------------------------------------------------------------------------
// Leaderboard cache
// ---------------------------------------------------------------------------

// Rebuilds the sorted set from Postgres if Redis lost it (restart, eviction, first read).
const ensureLeaderboard = async (room) => {
  const key = leaderboardKey(room.id);
  if (await redis.exists(key)) return;

  const [songs, counts] = await Promise.all([
    prisma.roomSong.findMany({ where: { roomId: room.id, removedAt: null }, select: { trackId: true } }),
    prisma.vote.groupBy({ by: ['trackId'], where: { roomId: room.id }, _count: { _all: true } })
  ]);
  if (!songs.length) return;

  const votesByTrack = new Map(counts.map((row) => [row.trackId, row._count._all]));
  // NX: never overwrite scores another request may already have incremented.
  await redis.zAdd(key, songs.map(({ trackId }) => ({ score: votesByTrack.get(trackId) || 0, value: trackId })), { NX: true });
  await redis.pExpireAt(key, room.expiresAt.getTime());
};

const getLeaderboard = async (roomId) => {
  const room = await requireRoom(roomId);
  await ensureLeaderboard(room);

  const ranked = await redis.zRangeWithScores(leaderboardKey(roomId), 0, -1, { REV: true });
  if (!ranked.length) return [];

  const tracks = await prisma.track.findMany({ where: { spotifyId: { in: ranked.map((item) => item.value) } } });
  const trackById = new Map(tracks.map((track) => [track.spotifyId, track]));

  return ranked.map(({ value: songId, score }) => {
    const track = trackById.get(songId);
    return {
      songId,
      votes: score,
      title: track?.title || 'Unknown',
      artist: track?.artist || 'Unknown',
      album: track?.album || '',
      image: track?.imageUrl || '',
      spotifyUrl: track?.spotifyUrl || '',
      previewUrl: track?.previewUrl || ''
    };
  });
};

// ---------------------------------------------------------------------------
// Songs and votes
// ---------------------------------------------------------------------------

const upsertTrack = (song) => {
  const data = {
    title: String(song.title).slice(0, 300),
    artist: String(song.artist).slice(0, 300),
    album: song.album ? String(song.album).slice(0, 300) : null,
    imageUrl: song.image || null,
    durationMs: Number.isFinite(song.duration) ? song.duration : null,
    previewUrl: song.previewUrl || null,
    spotifyUrl: song.spotifyUrl || null
  };
  return prisma.track.upsert({ where: { spotifyId: song.songId }, create: { spotifyId: song.songId, ...data }, update: data });
};

// Adds a song (or restores a removed one). Adding a song that is already in the room keeps its votes.
const addSongToRoom = async (roomId, song, addedById = null) => {
  const room = await requireRoom(roomId);
  await upsertTrack(song);
  await prisma.roomSong.upsert({
    where: { roomId_trackId: { roomId, trackId: song.songId } },
    create: { roomId, trackId: song.songId, addedById },
    update: { removedAt: null }
  });

  await ensureLeaderboard(room);
  await redis.zAdd(leaderboardKey(roomId), { score: 0, value: song.songId }, { NX: true });
  await redis.pExpireAt(leaderboardKey(roomId), room.expiresAt.getTime());
};

// Removing a song also clears its votes, so re-adding it starts from zero.
const removeSongFromRoom = async (roomId, songId) => {
  await requireRoom(roomId);
  await prisma.$transaction([
    prisma.roomSong.updateMany({ where: { roomId, trackId: songId, removedAt: null }, data: { removedAt: new Date() } }),
    prisma.vote.deleteMany({ where: { roomId, trackId: songId } })
  ]);
  await redis.zRem(leaderboardKey(roomId), songId);
};

// One vote per user per song, enforced by the votes primary key.
const voteSong = async (roomId, songId, userId) => {
  const room = await requireRoom(roomId);
  if (!room.votingOpen) {
    throw new VoteError('VOTING_CLOSED', 'Voting is closed');
  }

  const inRoom = await prisma.roomSong.findFirst({ where: { roomId, trackId: songId, removedAt: null } });
  if (!inRoom) {
    throw new VoteError('SONG_NOT_FOUND', 'This song is no longer in the room');
  }

  try {
    await prisma.vote.create({ data: { roomId, trackId: songId, userId } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new VoteError('ALREADY_VOTED', 'You have already voted for this song');
    throw error;
  }

  // Rebuild first if the cache was lost; the rebuild already includes this vote.
  const key = leaderboardKey(roomId);
  if (await redis.exists(key)) {
    await redis.zIncrBy(key, 1, songId);
  } else {
    await ensureLeaderboard(room);
  }

  return getLeaderboard(roomId);
};

const getUserVotes = async (roomId, userId) => {
  // Votes for removed songs are deleted on removal, so every remaining vote is current.
  const votes = await prisma.vote.findMany({ where: { roomId, userId }, select: { trackId: true } });
  return votes.map((vote) => vote.trackId);
};

// ---------------------------------------------------------------------------
// Song requests
// ---------------------------------------------------------------------------

const toRequestPayload = (request) => ({
  requestId: request.id,
  roomId: request.roomId,
  userId: request.userId,
  userName: request.user?.displayName || 'Guest',
  query: request.query,
  status: request.status.toLowerCase(),
  createdAt: request.createdAt.toISOString()
});

const submitSongRequest = async (roomId, { userId, query }) => {
  await requireRoom(roomId);
  const request = await prisma.songRequest.create({
    data: { roomId, userId, query },
    include: { user: { select: { displayName: true } } }
  });
  return toRequestPayload(request);
};

const getPendingSongRequests = async (roomId) => {
  const requests = await prisma.songRequest.findMany({
    where: { roomId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { displayName: true } } }
  });
  return requests.map(toRequestPayload);
};

const SPOTIFY_TRACK_PATTERNS = [
  /^([A-Za-z0-9]{22})$/,
  /spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]{22})/i,
  /spotify:track:([A-Za-z0-9]{22})/i
];

const extractSpotifyTrackId = (input = '') => {
  for (const pattern of SPOTIFY_TRACK_PATTERNS) {
    const match = input.trim().match(pattern);
    if (match) return match[1];
  }
  return null;
};

const resolveSongFromRequest = async (query) => {
  const trackId = extractSpotifyTrackId(query);
  if (trackId) return getTrackDetails(trackId);

  const [first] = await searchSongs(query);
  if (!first) throw new RequestError(`No Spotify match for "${query}"`);
  return first;
};

// Claims a pending request atomically, so two clicks cannot both process it.
const claimRequest = async (roomId, requestId, status) => {
  const request = await prisma.songRequest.findFirst({ where: { id: requestId, roomId } });
  if (!request) throw new RequestError('Song request not found');

  const { count } = await prisma.songRequest.updateMany({
    where: { id: requestId, roomId, status: 'PENDING' },
    data: { status }
  });
  if (!count) throw new RequestError('Song request was already handled');
  return request;
};

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');

const approveSongRequest = async (roomId, requestId, approvedById) => {
  if (!isUuid(requestId)) throw new RequestError('Song request not found');
  await requireRoom(roomId);
  const request = await claimRequest(roomId, requestId, 'APPROVED');

  try {
    const songData = await resolveSongFromRequest(request.query);
    await addSongToRoom(roomId, songData, approvedById);
    await prisma.songRequest.update({ where: { id: requestId }, data: { resolvedTrackId: songData.songId } });
    return { requestId, requesterId: request.userId, songData };
  } catch (error) {
    // Give the request back to the queue so the host can retry or reject it.
    await prisma.songRequest.update({ where: { id: requestId }, data: { status: 'PENDING' } });
    throw error;
  }
};

const rejectSongRequest = async (roomId, requestId) => {
  if (!isUuid(requestId)) throw new RequestError('Song request not found');
  await requireRoom(roomId);
  const request = await claimRequest(roomId, requestId, 'REJECTED');
  return { requestId, requesterId: request.userId };
};

module.exports = {
  RoomNotFoundError,
  VoteError,
  RequestError,
  leaderboardKey,
  getRoom,
  roomExists,
  createRoom,
  isRoomHost,
  addRoomMember,
  countMembers,
  setVotingStatus,
  getVotingStatus,
  deleteRoom,
  endExpiredRooms,
  getLeaderboard,
  addSongToRoom,
  removeSongFromRoom,
  voteSong,
  getUserVotes,
  submitSongRequest,
  getPendingSongRequests,
  approveSongRequest,
  rejectSongRequest,
  extractSpotifyTrackId
};
