const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startServer, stopServer, request, createGuestSession, createFixtures,
  connectClient, nextEvent, firstEvent, joinRoom
} = require('./helpers/server');

const song = (songId) => ({ songId, title: `Title ${songId}`, artist: 'Artist' });

describe('party room voting', () => {
  let server;
  let fixtures;
  let host;
  let guest;
  let roomId;
  const clients = [];

  const client = async (cookie) => {
    const socket = await connectClient(cookie);
    clients.push(socket);
    return socket;
  };

  const newGuest = async (name) => {
    const session = await createGuestSession(name);
    fixtures.trackUser(session.user.id);
    return session;
  };

  const vote = (socket, songId) => {
    const outcome = firstEvent(socket, ['vote_success', 'vote_rejected']);
    socket.emit('vote_song', { roomId, songId });
    return outcome;
  };

  before(async () => {
    server = await startServer();
    fixtures = await createFixtures();
    host = await fixtures.createSpotifySession('Host');
    guest = await newGuest('Ana');
    ({ body: { roomId } } = await request('POST', '/api/rooms', { cookie: host.cookie }));
  });

  after(async () => {
    clients.forEach((socket) => socket.close());
    await request('DELETE', `/api/rooms/${roomId}`, { cookie: host.cookie });
    await fixtures.cleanup();
    await stopServer(server);
  });

  it('reports voting as open when joining a new room', async () => {
    const admin = await client(host.cookie);
    const status = nextEvent(admin, 'voting_status_changed');
    await joinRoom(admin, roomId);
    assert.equal((await status).isOpen, true);

    const updated = nextEvent(admin, 'leaderboard_update');
    admin.emit('add_song', { roomId, songData: song('s1') });
    await updated;
  });

  it('accepts a first vote without closing and reopening voting', async () => {
    const socket = await client(guest.cookie);
    await joinRoom(socket, roomId);
    assert.equal((await vote(socket, 's1')).event, 'vote_success');
  });

  it('rejects duplicate votes and votes for unknown songs', async () => {
    const socket = await client(guest.cookie);
    await joinRoom(socket, roomId);

    assert.equal((await vote(socket, 's1')).data.code, 'ALREADY_VOTED');
    assert.equal((await vote(socket, 'missing')).data.code, 'SONG_NOT_FOUND');

    const { body } = await request('GET', `/api/rooms/${roomId}/leaderboard`, { cookie: guest.cookie });
    assert.deepEqual(body.leaderboard.map(({ songId, votes }) => ({ songId, votes })), [{ songId: 's1', votes: 1 }]);
  });

  it('restores the user\'s votes on a new connection', async () => {
    const socket = await client(guest.cookie);
    const { songIds } = await joinRoom(socket, roomId);
    assert.deepEqual(songIds, ['s1']);
  });

  it('rejects votes while closed and accepts them after reopening', async () => {
    const admin = await client(host.cookie);
    await joinRoom(admin, roomId);
    const other = await client((await newGuest('Ben')).cookie);
    await joinRoom(other, roomId);

    let status = nextEvent(other, 'voting_status_changed');
    admin.emit('toggle_voting', { roomId, isOpen: false });
    assert.equal((await status).isOpen, false);
    assert.equal((await vote(other, 's1')).data.code, 'VOTING_CLOSED');

    status = nextEvent(other, 'voting_status_changed');
    admin.emit('toggle_voting', { roomId, isOpen: true });
    await status;
    assert.equal((await vote(other, 's1')).event, 'vote_success');
  });

  it('shows pending requests only to the host and outcomes only to the requester', async () => {
    const admin = await client(host.cookie);
    await joinRoom(admin, roomId);
    const requester = await client(guest.cookie);
    await joinRoom(requester, roomId);
    const bystander = await client((await newGuest('Cy')).cookie);
    await joinRoom(bystander, roomId);

    const bystanderEvents = [];
    bystander.on('song_requests_updated', () => bystanderEvents.push('song_requests_updated'));
    bystander.on('song_request_processed', () => bystanderEvents.push('song_request_processed'));

    const pending = nextEvent(admin, 'song_requests_updated');
    requester.emit('submit_song_request', { roomId, query: 'anything' });
    const [requestItem] = await pending;
    assert.equal(requestItem.userName, 'Ana');

    const outcome = nextEvent(requester, 'song_request_processed');
    admin.emit('reject_song_request', { roomId, requestId: requestItem.requestId });
    assert.equal((await outcome).status, 'rejected');

    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.deepEqual(bystanderEvents, []);
  });

  it('keeps votes when a song is added again, and resets them after removal', async () => {
    const admin = await client(host.cookie);
    await joinRoom(admin, roomId);

    let updated = nextEvent(admin, 'leaderboard_update');
    admin.emit('add_song', { roomId, songData: song('s1') });
    const [top] = await updated;
    assert.equal(top.votes, 2, 're-adding must not reset votes');

    updated = nextEvent(admin, 'leaderboard_update');
    admin.emit('remove_song', { roomId, songId: 's1' });
    await updated;
    updated = nextEvent(admin, 'leaderboard_update');
    admin.emit('add_song', { roomId, songData: song('s1') });
    await updated;

    const socket = await client(guest.cookie);
    await joinRoom(socket, roomId);
    assert.equal((await vote(socket, 's1')).event, 'vote_success');
  });
});
