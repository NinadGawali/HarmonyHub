const { prisma } = require('../config/db');
const { redis } = require('../config/redis');
const { encrypt, decrypt } = require('../auth/tokenCrypto');
const spotifyAuthService = require('./spotifyAuthService');

// Refresh a little before Spotify's expiry so callers never receive an about-to-expire token.
const ACCESS_TOKEN_SAFETY_MARGIN_SECONDS = 60;
const DISPLAY_NAME_MAX_LENGTH = 40;

class SpotifyReauthRequiredError extends Error {
  constructor() {
    super('Spotify session expired. Please log in with Spotify again.');
    this.name = 'SpotifyReauthRequiredError';
  }
}

const accessTokenKey = (userId) => `spotify:access:${userId}`;

// Public shape of a user as sent to clients.
const toPublicUser = (user) => ({
  id: user.id,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl || null,
  isGuest: user.isGuest,
  product: user.product || null
});

const normalizeDisplayName = (value) => {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return name.length >= 1 && name.length <= DISPLAY_NAME_MAX_LENGTH ? name : null;
};

const getUserById = (id) => prisma.user.findUnique({ where: { id } });

const createGuest = (displayName) => prisma.user.create({
  data: { isGuest: true, displayName }
});

const cacheAccessToken = async (userId, { access_token: accessToken, expires_in: expiresIn }) => {
  const ttlSeconds = Math.max(Number(expiresIn || 3600) - ACCESS_TOKEN_SAFETY_MARGIN_SECONDS, 60);
  const expiresAt = Date.now() + ttlSeconds * 1000;
  await redis.set(accessTokenKey(userId), JSON.stringify({ accessToken, expiresAt }), { EX: ttlSeconds });
  return { accessToken, expiresAt };
};

// Creates or updates the user for a Spotify profile and stores their tokens.
const upsertSpotifyUser = async (profile, tokens) => {
  const profileData = {
    displayName: profile.display_name || profile.id,
    email: profile.email || null,
    avatarUrl: profile.images?.[0]?.url || null,
    country: profile.country || null,
    product: profile.product || null,
    lastLoginAt: new Date()
  };

  const user = await prisma.$transaction(async (tx) => {
    const saved = await tx.user.upsert({
      where: { spotifyId: profile.id },
      create: { ...profileData, spotifyId: profile.id, isGuest: false },
      update: profileData
    });

    await tx.spotifyToken.upsert({
      where: { userId: saved.id },
      create: { userId: saved.id, refreshTokenEnc: encrypt(tokens.refresh_token), scope: tokens.scope || '' },
      update: { refreshTokenEnc: encrypt(tokens.refresh_token), scope: tokens.scope || '' }
    });

    return saved;
  });

  await cacheAccessToken(user.id, tokens);
  return user;
};

// Returns a valid Spotify access token for the user, refreshing it server-side when needed.
const getSpotifyAccessToken = async (userId) => {
  const cached = await redis.get(accessTokenKey(userId));
  if (cached) {
    return JSON.parse(cached);
  }

  const stored = await prisma.spotifyToken.findUnique({ where: { userId } });
  if (!stored) {
    throw new SpotifyReauthRequiredError();
  }

  let tokens;
  try {
    tokens = await spotifyAuthService.refreshAccessToken(decrypt(stored.refreshTokenEnc));
  } catch (error) {
    // invalid_grant means the refresh token was revoked; the user must log in again.
    if (error.response?.status === 400) {
      await prisma.spotifyToken.delete({ where: { userId } }).catch(() => {});
      throw new SpotifyReauthRequiredError();
    }
    throw error;
  }

  if (tokens.refresh_token) {
    // Spotify may rotate refresh tokens.
    await prisma.spotifyToken.update({
      where: { userId },
      data: { refreshTokenEnc: encrypt(tokens.refresh_token), scope: tokens.scope || stored.scope }
    });
  }

  return cacheAccessToken(userId, tokens);
};

module.exports = {
  SpotifyReauthRequiredError,
  DISPLAY_NAME_MAX_LENGTH,
  toPublicUser,
  normalizeDisplayName,
  getUserById,
  createGuest,
  upsertSpotifyUser,
  getSpotifyAccessToken
};
