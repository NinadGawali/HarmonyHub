import { describe, expect, it } from 'vitest';
import { formatDuration, isPlayableTrack, nextByVotes, nextInOrder, previousInOrder } from './queue';

const id = (letter) => letter.repeat(22);
const songs = [
  { songId: id('a') },
  { songId: 'generated_x1' },
  { songId: id('b') },
  { songId: id('c') }
];

describe('isPlayableTrack', () => {
  it('accepts 22-character Spotify ids only', () => {
    expect(isPlayableTrack({ songId: id('a') })).toBe(true);
    expect(isPlayableTrack({ songId: 'generated_x1' })).toBe(false);
    expect(isPlayableTrack(null)).toBe(false);
  });
});

describe('nextInOrder', () => {
  it('starts with the first playable song', () => {
    expect(nextInOrder(songs, null)).toBe(id('a'));
  });

  it('skips unplayable songs and stops at the end', () => {
    expect(nextInOrder(songs, id('a'))).toBe(id('b'));
    expect(nextInOrder(songs, id('c'))).toBeNull();
  });

  it('restarts from the top when the current song disappeared', () => {
    expect(nextInOrder(songs, id('z'))).toBe(id('a'));
  });
});

describe('previousInOrder', () => {
  it('returns the previous playable song', () => {
    expect(previousInOrder(songs, id('b'))).toBe(id('a'));
    expect(previousInOrder(songs, id('a'))).toBeNull();
  });
});

describe('nextByVotes', () => {
  it('picks the highest-ranked song that has not been played', () => {
    expect(nextByVotes(songs, null)).toBe(id('a'));
    expect(nextByVotes(songs, id('a'), new Set([id('a')]))).toBe(id('b'));
    expect(nextByVotes(songs, id('b'), new Set([id('a'), id('b')]))).toBe(id('c'));
  });

  it('returns null when everything has been played', () => {
    expect(nextByVotes(songs, id('c'), new Set([id('a'), id('b'), id('c')]))).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats milliseconds as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(61_500)).toBe('1:01');
    expect(formatDuration(undefined)).toBe('0:00');
  });
});
