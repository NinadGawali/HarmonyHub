const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startServer, stopServer, request, connectClient, nextEvent, firstEvent
} = require('./helpers/server');

const song = (songId) => ({ songId, title: `Title ${songId}`, artist: 'Artist' });

describe('party room voting', () => {
  let server;
  let roomId;
  let guestId;
  const clients = [];

  const client = async () => {
    const socket = await connectClient();
    clients.push(socket);
    return socket;
  };

  const join = async (socket, userId) => {
    const myVotes = nextEvent(socket, 'my_votes');
    socket.emit('join_room', { roomId, userId });
    return myVotes;
  };

  const vote = (socket, songId, userId) => {
    const outcome = firstEvent(socket, ['vote_success', 'vote_rejected']);
    socket.emit('vote_song', { roomId, songId, userId });
    return outcome;
  };

  before(async () => {
    server = await startServer();
    ({ body: { roomId } } = await request('POST', '/api/rooms', { adminName: 'Host' }));
    ({ body: { userId: guestId } } = await request('POST', `/api/rooms/${roomId}/join`, { userName: 'Ana' }));
  });

  after(async () => {
    clients.forEach((socket) => socket.close());
    await request('DELETE', `/api/rooms/${roomId}`);
    await stopServer(server);
  });

  it('reports voting as open when joining a new room', async () => {
    const admin = await client();
    const status = nextEvent(admin, 'voting_status_changed');
    admin.emit('join_room', { roomId });
    assert.equal((await status).isOpen, true);

    const updated = nextEvent(admin, 'leaderboard_update');
    admin.emit('add_song', { roomId, songData: song('s1') });
    await updated;
  });

  it('accepts a first vote without closing and reopening voting', async () => {
    const guest = await client();
    await join(guest, guestId);
    const { event } = await vote(guest, 's1', guestId);
    assert.equal(event, 'vote_success');
  });

  it('rejects duplicate votes and votes for unknown songs', async () => {
    const guest = await client();
    await join(guest, guestId);

    const duplicate = await vote(guest, 's1', guestId);
    assert.equal(duplicate.data.code, 'ALREADY_VOTED');

    const unknown = await vote(guest, 'missing', guestId);
    assert.equal(unknown.data.code, 'SONG_NOT_FOUND');

    const { body } = await request('GET', `/api/rooms/${roomId}/leaderboard`);
    assert.deepEqual(body.leaderboard.map(({ songId, votes }) => ({ songId, votes })), [{ songId: 's1', votes: 1 }]);
  });

  it('restores the user\'s votes after a refresh', async () => {
    const refreshed = await client();
    const { songIds } = await join(refreshed, guestId);
    assert.deepEqual(songIds, ['s1']);
  });

  it('rejects votes while closed and accepts them after reopening', async () => {
    const admin = await client();
    const other = await client();
    await join(other, 'other-user');

    let status = nextEvent(other, 'voting_status_changed');
    admin.emit('toggle_voting', { roomId, isOpen: false });
    assert.equal((await status).isOpen, false);
    assert.equal((await vote(other, 's1', 'other-user')).data.code, 'VOTING_CLOSED');

    status = nextEvent(other, 'voting_status_changed');
    admin.emit('toggle_voting', { roomId, isOpen: true });
    await status;
    assert.equal((await vote(other, 's1', 'other-user')).event, 'vote_success');
  });

  it('sends a request outcome only to the requester', async () => {
    const admin = await client();
    const guest = await client();
    const bystander = await client();
    admin.emit('join_room', { roomId });
    await join(guest, guestId);
    await join(bystander, 'bystander');

    let bystanderNotified = false;
    bystander.on('song_request_processed', () => { bystanderNotified = true; });

    const pending = nextEvent(admin, 'song_requests_updated');
    guest.emit('submit_song_request', { roomId, userId: guestId, userName: 'Ana', query: 'anything' });
    const [requestItem] = await pending;

    const outcome = nextEvent(guest, 'song_request_processed');
    admin.emit('reject_song_request', { roomId, requestId: requestItem.requestId });
    assert.equal((await outcome).status, 'rejected');

    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(bystanderNotified, false);
  });

  it('keeps votes when a song is added again, and resets them after removal', async () => {
    const admin = await client();
    admin.emit('join_room', { roomId });

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

    const guest = await client();
    await join(guest, guestId);
    assert.equal((await vote(guest, 's1', guestId)).event, 'vote_success');
  });
});
