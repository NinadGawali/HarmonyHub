const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('redis');
const { config } = require('../src/config/env');
const {
  startServer, stopServer, request, connectClient, nextEvent
} = require('./helpers/server');

describe('room lifecycle and health', () => {
  let server;
  let redis;
  let socket;

  before(async () => {
    server = await startServer();
    redis = createClient({ url: config.redisUrl });
    await redis.connect();
    socket = await connectClient();
  });

  after(async () => {
    socket.close();
    await redis.quit();
    await stopServer(server);
  });

  it('reports required dependencies in /health', async () => {
    const { status, body } = await request('GET', '/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.checks.postgres.status, 'up');
    assert.equal(body.checks.redis.status, 'up');
    assert.equal(body.checks.recommender.required, false);
  });

  it('gives every room key a TTL and deletes all of them with the room', async () => {
    const { body: { roomId } } = await request('POST', '/api/rooms', { adminName: 'Host' });
    const { body: { userId } } = await request('POST', `/api/rooms/${roomId}/join`, { userName: 'Ana' });

    socket.emit('join_room', { roomId, userId });
    await nextEvent(socket, 'my_votes');

    const added = nextEvent(socket, 'leaderboard_update');
    socket.emit('add_song', { roomId, songData: { songId: `ttl-${roomId}`, title: 'T', artist: 'A' } });
    await added;

    const voted = nextEvent(socket, 'vote_success');
    socket.emit('vote_song', { roomId, songId: `ttl-${roomId}`, userId });
    await voted;

    const submitted = nextEvent(socket, 'song_request_submitted');
    socket.emit('submit_song_request', { roomId, userId, userName: 'Ana', query: 'q' });
    const { requestId } = await submitted;

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

    await request('DELETE', `/api/rooms/${roomId}`);
    assert.equal(await redis.exists(roomKeys), 0, 'all room keys should be deleted');
  });

  it('rejects writes to an expired room instead of recreating it', async () => {
    const roomId = 'GONE01';
    await redis.del(`room:${roomId}`);

    const error = nextEvent(socket, 'error');
    socket.emit('toggle_voting', { roomId, isOpen: false });
    assert.match((await error).message, /not found or expired/);
    assert.equal(await redis.exists(`room:${roomId}`), 0);

    const addError = nextEvent(socket, 'error');
    socket.emit('add_song', { roomId, songData: { songId: 'x', title: 'X', artist: 'Y' } });
    assert.match((await addError).message, /not found or expired/);
    assert.equal(await redis.exists(`leaderboard:${roomId}`), 0);
  });
});
