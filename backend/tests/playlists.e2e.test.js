const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { startServer, stopServer, request, createGuestSession, createFixtures } = require('./helpers/server');

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

describe('AI playlist generation', () => {
  let backend;
  let recommender;
  let fixtures;
  let host;

  before(async () => {
    recommender = await startFakeRecommender();
    backend = await startServer({
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
});
