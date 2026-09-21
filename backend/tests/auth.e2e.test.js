const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { config } = require('../src/config/env');
const {
  startServer, stopServer, request, sessionCookieFrom, createGuestSession, createFixtures,
  connectClient, nextEvent, joinRoom
} = require('./helpers/server');

describe('authentication and authorization', () => {
  let server;
  let fixtures;
  let host;
  let guest;
  let roomId;

  before(async () => {
    server = await startServer();
    fixtures = await createFixtures();
    host = await fixtures.createSpotifySession('Host');
    guest = await createGuestSession('Ana');
    fixtures.trackUser(guest.user.id);
    ({ body: { roomId } } = await request('POST', '/api/rooms', { cookie: host.cookie }));
  });

  after(async () => {
    await request('DELETE', `/api/rooms/${roomId}`, { cookie: host.cookie });
    await fixtures.cleanup();
    await stopServer(server);
  });

  describe('sessions', () => {
    it('returns 401 from /me without a session', async () => {
      assert.equal((await request('GET', '/api/auth/me')).status, 401);
    });

    it('creates a guest session with an httpOnly cookie', async () => {
      const response = await request('POST', '/api/auth/guest', { body: { displayName: '  Zoe  ' } });
      assert.equal(response.status, 201);
      fixtures.trackUser(response.body.user.id);
      assert.equal(response.body.user.displayName, 'Zoe');
      assert.equal(response.body.user.isGuest, true);
      assert.match(response.headers.get('set-cookie'), /HttpOnly/i);

      const me = await request('GET', '/api/auth/me', { cookie: sessionCookieFrom(response.headers) });
      assert.equal(me.body.user.id, response.body.user.id);
    });

    it('rejects empty and overlong guest names', async () => {
      for (const displayName of ['', '   ', 'x'.repeat(41)]) {
        assert.equal((await request('POST', '/api/auth/guest', { body: { displayName } })).status, 400);
      }
    });

    it('logs out and invalidates the session', async () => {
      const session = await createGuestSession('Temp');
      fixtures.trackUser(session.user.id);
      assert.equal((await request('POST', '/api/auth/logout', { cookie: session.cookie })).status, 204);
      assert.equal((await request('GET', '/api/auth/me', { cookie: session.cookie })).status, 401);
    });
  });

  describe('Spotify login', () => {
    it('redirects to Spotify with the configured redirect URI, state and PKCE', async () => {
      const response = await request('GET', '/api/auth/spotify/login?returnTo=%2Froom%2FABC123');
      assert.equal(response.status, 302);

      const location = new URL(response.headers.get('location'));
      assert.equal(location.origin, 'https://accounts.spotify.com');
      assert.equal(location.searchParams.get('redirect_uri'), config.spotify.redirectUri);
      assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(location.searchParams.get('code_challenge'));

      const stored = JSON.parse(await fixtures.redis.get(`oauth:${location.searchParams.get('state')}`));
      assert.equal(stored.returnTo, '/room/ABC123');
    });

    it('never stores an off-site returnTo (open redirect)', async () => {
      const response = await request('GET', '/api/auth/spotify/login?returnTo=%2F%2Fevil.example');
      const state = new URL(response.headers.get('location')).searchParams.get('state');
      const stored = JSON.parse(await fixtures.redis.get(`oauth:${state}`));
      assert.equal(stored.returnTo, '/');
    });

    it('rejects a callback with an unknown state', async () => {
      const response = await request('GET', '/api/auth/spotify/callback?code=abc&state=forged');
      assert.equal(response.status, 302);
      const location = new URL(response.headers.get('location'));
      assert.equal(location.pathname, '/login');
      assert.match(location.searchParams.get('error'), /expired|already used/);
    });
  });

  describe('route guards', () => {
    it('requires a session for rooms and Spotify login for hosting and Spotify APIs', async () => {
      assert.equal((await request('GET', `/api/rooms/${roomId}`)).status, 401);
      assert.equal((await request('POST', '/api/rooms', { cookie: guest.cookie })).status, 401);
      assert.equal((await request('GET', '/api/spotify/search?q=x', { cookie: guest.cookie })).status, 401);
      assert.equal((await request('GET', '/api/auth/spotify/token', { cookie: guest.cookie })).status, 401);
    });

    it('tells each user whether they host the room', async () => {
      const asHost = await request('GET', `/api/rooms/${roomId}`, { cookie: host.cookie });
      const asGuest = await request('GET', `/api/rooms/${roomId}`, { cookie: guest.cookie });
      assert.equal(asHost.body.isHost, true);
      assert.equal(asGuest.body.isHost, false);
      assert.equal(asHost.body.hostUserId, undefined, 'host id is not exposed');
    });

    it('only lets the host delete a room', async () => {
      assert.equal((await request('DELETE', `/api/rooms/${roomId}`, { cookie: guest.cookie })).status, 403);
    });
  });

  describe('sockets', () => {
    it('refuses connections without a session', async () => {
      await assert.rejects(connectClient(null), /Not signed in/);
    });

    it('rejects host-only events from guests', async () => {
      const socket = await connectClient(guest.cookie);
      await joinRoom(socket, roomId);

      for (const [event, payload] of [
        ['toggle_voting', { roomId, isOpen: false }],
        ['add_song', { roomId, songData: { songId: 'g1', title: 'G', artist: 'G' } }],
        ['remove_song', { roomId, songId: 'g1' }],
        ['get_song_requests', { roomId }]
      ]) {
        const error = nextEvent(socket, 'error');
        socket.emit(event, payload);
        assert.equal((await error).message, 'Only the host can do that', event);
      }
      socket.close();
    });

    it('ignores a client-supplied userId when voting', async () => {
      const admin = await connectClient(host.cookie);
      await joinRoom(admin, roomId);
      const added = nextEvent(admin, 'leaderboard_update');
      admin.emit('add_song', { roomId, songData: { songId: 'spoof', title: 'S', artist: 'S' } });
      await added;

      const socket = await connectClient(guest.cookie);
      await joinRoom(socket, roomId);
      const first = nextEvent(socket, 'vote_success');
      socket.emit('vote_song', { roomId, songId: 'spoof', userId: 'someone-else' });
      await first;

      const second = nextEvent(socket, 'vote_rejected');
      socket.emit('vote_song', { roomId, songId: 'spoof', userId: 'yet-another-id' });
      assert.equal((await second).code, 'ALREADY_VOTED');

      admin.close();
      socket.close();
    });

    it('does not let a host process another room\'s requests', async () => {
      const otherHost = await fixtures.createSpotifySession('Other host');
      const { body: { roomId: otherRoomId } } = await request('POST', '/api/rooms', { cookie: otherHost.cookie });

      const requester = await connectClient(guest.cookie);
      await joinRoom(requester, roomId);
      const submitted = nextEvent(requester, 'song_request_submitted');
      requester.emit('submit_song_request', { roomId, query: 'cross room' });
      const { requestId } = await submitted;

      const intruder = await connectClient(otherHost.cookie);
      await joinRoom(intruder, otherRoomId);
      const error = nextEvent(intruder, 'error');
      intruder.emit('reject_song_request', { roomId: otherRoomId, requestId });
      assert.equal((await error).message, 'Song request not found');

      requester.close();
      intruder.close();
      await request('DELETE', `/api/rooms/${otherRoomId}`, { cookie: otherHost.cookie });
    });
  });

  describe('location', () => {
    it('stores location per user instead of globally', async () => {
      const other = await createGuestSession('Bo');
      fixtures.trackUser(other.user.id);

      await request('POST', '/api/location', { cookie: guest.cookie, body: { latitude: 19.07, longitude: 72.87, state: 'Maharashtra' } });
      await request('POST', '/api/location', { cookie: other.cookie, body: { latitude: 12.97, longitude: 77.59, state: 'Karnataka' } });

      const mine = await request('GET', '/api/location/latest', { cookie: guest.cookie });
      const theirs = await request('GET', '/api/location/latest', { cookie: other.cookie });
      assert.equal(mine.body.location.state, 'Maharashtra');
      assert.equal(theirs.body.location.state, 'Karnataka');
    });

    it('rejects invalid coordinates', async () => {
      const response = await request('POST', '/api/location', { cookie: guest.cookie, body: { latitude: 200, longitude: 0 } });
      assert.equal(response.status, 400);
    });
  });
});
