const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startServer, stopServer, request, createGuestSession, createFixtures,
  connectClient, nextEvent, joinRoom
} = require('./helpers/server');

describe('room lifecycle and health', () => {
  let server;
  let fixtures;
  let host;
  let hostSocket;

  before(async () => {
    server = await startServer();
    fixtures = await createFixtures();
    host = await fixtures.createSpotifySession('Host');
    hostSocket = await connectClient(host.cookie);
  });

  after(async () => {
    hostSocket.close();
    await fixtures.cleanup();
    await stopServer(server);
  });

  it('reports required dependencies in /health and /api/health', async () => {
    for (const path of ['/health', '/api/health']) {
      const { status, body } = await request('GET', path);
      assert.equal(status, 200);
      assert.equal(body.status, 'ok');
      assert.equal(body.checks.postgres.status, 'up');
      assert.equal(body.checks.redis.status, 'up');
      assert.equal(body.checks.recommender.required, false);
    }
  });

  it('gives every room key a TTL and deletes all of them with the room', async () => {
    const { redis } = fixtures;
    const { body: { roomId } } = await request('POST', '/api/rooms', { cookie: host.cookie });
    const guest = await createGuestSession('Ana');
    fixtures.trackUser(guest.user.id);
    await request('POST', `/api/rooms/${roomId}/join`, { cookie: guest.cookie });

    await joinRoom(hostSocket, roomId);
    const added = nextEvent(hostSocket, 'leaderboard_update');
    hostSocket.emit('add_song', { roomId, songData: { songId: `ttl-${roomId}`, title: 'T', artist: 'A' } });
    await added;

    const guestSocket = await connectClient(guest.cookie);
    await joinRoom(guestSocket, roomId);
    const voted = nextEvent(guestSocket, 'vote_success');
    guestSocket.emit('vote_song', { roomId, songId: `ttl-${roomId}` });
    await voted;

    const submitted = nextEvent(guestSocket, 'song_request_submitted');
    guestSocket.emit('submit_song_request', { roomId, query: 'q' });
    const { requestId } = await submitted;
    guestSocket.close();

    const roomKeys = [
      `room:${roomId}`,
      `leaderboard:${roomId}`,
      `roomUsers:${roomId}`,
      `votes:${roomId}:ttl-${roomId}`,
      `songrequests:pending:${roomId}`,
      `songrequest:${requestId}`
    ];

    for (const key of roomKeys) {
      const ttl = await redis.ttl(key);
      assert.ok(ttl > 0, `${key} should expire (ttl=${ttl})`);
    }

    const deleted = await request('DELETE', `/api/rooms/${roomId}`, { cookie: host.cookie });
    assert.equal(deleted.status, 200);
    assert.equal(await redis.exists(roomKeys), 0, 'all room keys should be deleted');
  });

  it('rejects writes to an expired room instead of recreating it', async () => {
    const { redis } = fixtures;
    const { body: { roomId } } = await request('POST', '/api/rooms', { cookie: host.cookie });
    await joinRoom(hostSocket, roomId);

    // Simulate expiry while the host is still connected.
    await redis.del(`room:${roomId}`);

    const error = nextEvent(hostSocket, 'error');
    hostSocket.emit('toggle_voting', { roomId, isOpen: false });
    assert.match((await error).message, /not found or expired/);
    assert.equal(await redis.exists(`room:${roomId}`), 0);

    const addError = nextEvent(hostSocket, 'error');
    hostSocket.emit('add_song', { roomId, songData: { songId: 'x', title: 'X', artist: 'Y' } });
    assert.match((await addError).message, /not found or expired/);
    assert.equal(await redis.exists(`leaderboard:${roomId}`), 0);
  });
});
