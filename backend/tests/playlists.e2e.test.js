const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const {
  startServer, stopServer, request, createGuestSession, createFixtures, connectClient, nextEvent, joinRoom
} = require('./helpers/server');

const TOKEN = 'test-internal-token';
const GENERATIONS_PER_MINUTE = 3;

// Stands in for the Python recommender and records what the backend sent.
const startFakeRecommender = () => new Promise((resolve) => {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ path: req.url, token: req.headers['x-internal-token'], body });
      if (body.prompt === 'make it fail') {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Spotify is unavailable right now.' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        assistant_message: 'Search results for your prompt.',
        used_fallback: true,
        fallback_reason: 'ai_unavailable',
        model: null,
        from_cache: false,
        tracks: [{
          spotify_id: '4cOdK2wGLETKBW3PvgPWqT', title: 'Song', artist: 'Artist', album: 'Album',
          image: 'https://img', duration_ms: 1000, spotify_url: 'https://open.spotify.com/track/x',
          preview_url: null, reason: 'Fits.', source: 'search'
        }]
      }));
    });
  });
  server.listen(0, '127.0.0.1', () => resolve({ server, calls, url: `http://127.0.0.1:${server.address().port}` }));
});

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

// Stands in for the Spotify Web API (create playlist, add items).
const startFakeSpotify = () => new Promise((resolve) => {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ method: req.method, path: req.url, auth: req.headers.authorization, body });
      if (req.headers.authorization === 'Bearer revoked') return json(res, 403, { error: { status: 403 } });
      if (req.method === 'POST' && req.url === '/me/playlists') {
        return json(res, 201, { id: 'pl1', name: body.name, external_urls: { spotify: 'https://open.spotify.com/playlist/pl1' } });
      }
      if (req.method === 'POST' && req.url === '/playlists/pl1/items') return json(res, 201, { snapshot_id: 'snap' });
      return json(res, 404, { error: { status: 404 } });
    });
  });
  server.listen(0, '127.0.0.1', () => resolve({ server, calls, url: `http://127.0.0.1:${server.address().port}` }));
});

const TRACK_A = '4cOdK2wGLETKBW3PvgPWqT';
const TRACK_B = '7ouMYWpwJ422jRcDASZB7P';

describe('AI playlist generation', () => {
  let backend;
  let recommender;
  let fixtures;
  let host;
  let spotify;

  // Seeds the cached Spotify access token, so no real token refresh happens.
  const giveAccessToken = (userId, accessToken) => fixtures.redis.set(
    `spotify:access:${userId}`,
    JSON.stringify({ accessToken, expiresAt: Date.now() + 3600 * 1000 }),
    { EX: 600 }
  );

  before(async () => {
    recommender = await startFakeRecommender();
    spotify = await startFakeSpotify();
    backend = await startServer({
      SPOTIFY_API_URL: spotify.url,
      PYTHON_RECOMMENDER_URL: recommender.url,
      RECOMMENDER_INTERNAL_TOKEN: TOKEN,
      PLAYLIST_GENERATIONS_PER_MINUTE: String(GENERATIONS_PER_MINUTE)
    });
    fixtures = await createFixtures();
    host = await fixtures.createSpotifySession('Host');
  });

  after(async () => {
    await fixtures.cleanup();
    await stopServer(backend);
    await new Promise((resolve) => recommender.server.close(resolve));
    await new Promise((resolve) => spotify.server.close(resolve));
  });

  it('requires Spotify login and a prompt', async () => {
    const guest = await createGuestSession('Guest');
    fixtures.trackUser(guest.user.id);
    assert.equal((await request('POST', '/api/playlists/generate', { cookie: guest.cookie, body: { prompt: 'x' } })).status, 401);
    assert.equal((await request('POST', '/api/playlists/generate', { cookie: host.cookie, body: { prompt: '  ' } })).status, 400);
  });

  it('proxies to the recommender with the internal token and returns playable songs', async () => {
    const response = await request('POST', '/api/playlists/generate', {
      cookie: host.cookie,
      body: { prompt: 'rainy day lo-fi', artist: 'Nujabes', count: 99 }
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.usedFallback, true);
    assert.equal(response.body.fallbackReason, 'ai_unavailable');
    assert.deepEqual(response.body.songs[0], {
      songId: '4cOdK2wGLETKBW3PvgPWqT', title: 'Song', artist: 'Artist', album: 'Album', image: 'https://img',
      spotifyUrl: 'https://open.spotify.com/track/x', previewUrl: '', duration: 1000, reason: 'Fits.', source: 'search'
    });

    const call = recommender.calls.at(-1);
    assert.equal(call.path, '/v1/recommend');
    assert.equal(call.token, TOKEN);
    assert.deepEqual(call.body, { prompt: 'rainy day lo-fi', artist: 'Nujabes', count: 15, market: null });
  });

  it('returns 503 when the recommender fails', async () => {
    const response = await request('POST', '/api/playlists/generate', { cookie: host.cookie, body: { prompt: 'make it fail' } });
    assert.equal(response.status, 503);
  });

  it('limits generations per user', async () => {
    const other = await fixtures.createSpotifySession('Busy host');
    const statuses = [];
    for (let i = 0; i < GENERATIONS_PER_MINUTE + 1; i += 1) {
      // The old path still works for one release.
      statuses.push((await request('POST', '/api/playlists/recommendations', {
        cookie: other.cookie, body: { description: `prompt ${i}` }
      })).status);
    }
    assert.deepEqual(statuses, [...Array(GENERATIONS_PER_MINUTE).fill(200), 429]);
  });

  it('saves songs as a private playlist in the user Spotify account', async () => {
    const saver = await fixtures.createSpotifySession('Saver');
    await giveAccessToken(saver.user.id, 'good-token');

    const response = await request('POST', '/api/playlists/export', {
      cookie: saver.cookie,
      body: { name: 'Rainy day', description: 'line one\nline two', trackIds: [TRACK_A, 'not-a-track', TRACK_B, TRACK_A] }
    });
    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'pl1', name: 'Rainy day', url: 'https://open.spotify.com/playlist/pl1', trackCount: 2
    });

    const [create, add] = spotify.calls.slice(-2);
    assert.equal(create.auth, 'Bearer good-token');
    assert.deepEqual(create.body, { name: 'Rainy day', description: 'line one line two', public: false });
    assert.equal(add.path, '/playlists/pl1/items');
    assert.deepEqual(add.body.uris, [`spotify:track:${TRACK_A}`, `spotify:track:${TRACK_B}`]);
  });

  it('rejects empty exports, guests, and asks to reconnect when Spotify refuses', async () => {
    const guest = await createGuestSession('Guest saver');
    fixtures.trackUser(guest.user.id);
    assert.equal((await request('POST', '/api/playlists/export', { cookie: guest.cookie, body: { trackIds: [TRACK_A] } })).status, 401);
    assert.equal((await request('POST', '/api/playlists/export', { cookie: host.cookie, body: { trackIds: ['x'] } })).status, 400);

    const revoked = await fixtures.createSpotifySession('Revoked');
    await giveAccessToken(revoked.user.id, 'revoked');
    const response = await request('POST', '/api/playlists/export', { cookie: revoked.cookie, body: { trackIds: [TRACK_A] } });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'SPOTIFY_RECONNECT');
  });

  it('lets the host fill a room with AI songs, skipping songs already there', async () => {
    const roomHost = await fixtures.createSpotifySession('AI host');
    const { body: { roomId } } = await request('POST', '/api/rooms', { cookie: roomHost.cookie });
    const socket = await connectClient(roomHost.cookie);
    try {
      await joinRoom(socket, roomId);

      const updated = nextEvent(socket, 'leaderboard_update');
      const done = nextEvent(socket, 'ai_fill_done');
      socket.emit('ai_fill_queue', { roomId, prompt: 'rainy day lo-fi', count: 8 });
      assert.deepEqual(await done, {
        added: 1, skipped: 0, message: 'Search results for your prompt.', usedFallback: true
      });
      assert.deepEqual((await updated).map((song) => song.songId), [TRACK_A]);
      assert.deepEqual(recommender.calls.at(-1).body, { prompt: 'rainy day lo-fi', count: 8, market: null });

      const again = nextEvent(socket, 'ai_fill_done');
      socket.emit('ai_fill_queue', { roomId, prompt: 'rainy day lo-fi' });
      assert.equal((await again).skipped, 1);

      const error = nextEvent(socket, 'error');
      socket.emit('ai_fill_queue', { roomId, prompt: '   ' });
      assert.equal((await error).event, 'ai_fill_queue');
    } finally {
      socket.close();
      await request('DELETE', `/api/rooms/${roomId}`, { cookie: roomHost.cookie });
    }
  });

  it('does not let guests fill the room', async () => {
    const roomHost = await fixtures.createSpotifySession('Host 2');
    const guest = await createGuestSession('Sneaky');
    fixtures.trackUser(guest.user.id);
    const { body: { roomId } } = await request('POST', '/api/rooms', { cookie: roomHost.cookie });
    await request('POST', `/api/rooms/${roomId}/join`, { cookie: guest.cookie });
    const socket = await connectClient(guest.cookie);
    try {
      await joinRoom(socket, roomId);
      const error = nextEvent(socket, 'error');
      socket.emit('ai_fill_queue', { roomId, prompt: 'anything' });
      assert.match((await error).message, /host/i);
    } finally {
      socket.close();
      await request('DELETE', `/api/rooms/${roomId}`, { cookie: roomHost.cookie });
    }
  });
});
