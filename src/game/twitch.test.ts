import { describe, expect, it } from 'vitest';
import { matchVote, parseIrc, tally, validChannel, winner } from './twitch';

const opts = [{ id: 'a', label: 'FAZE 2018', aliases: ['FaZe Clan', 'FAZE'] }, { id: 'b', label: 'AST 2018', aliases: ['Astralis', 'AST'] }, { id: 'c', label: 'NAVI 2021', aliases: ['NAVI'] }];

describe('twitch chat votes', () => {
  it('reads chat lines with and without tags, and answers pings', () => {
    expect(parseIrc(':someone!someone@someone.tmi.twitch.tv PRIVMSG #chan :2')).toEqual({ msg: { user: 'someone', text: '2' } });
    expect(parseIrc('@badge-info=;display-name=CoolGuy;color=#fff :coolguy!coolguy@coolguy.tmi.twitch.tv PRIVMSG #chan :!astralis')).toEqual({ msg: { user: 'coolguy', text: '!astralis' } });
    expect(parseIrc('PING :tmi.twitch.tv')).toEqual({ ping: ':tmi.twitch.tv' });
    expect(parseIrc(':tmi.twitch.tv 001 justinfan123 :Welcome, GLHF!')).toBeNull();
  });
  it('counts only messages that are a number or an option name', () => {
    expect(matchVote('2', opts)).toBe('b');
    expect(matchVote('!3', opts)).toBe('c');
    expect(matchVote('faze clan', opts)).toBe('a');
    expect(matchVote('  AST ', opts)).toBe('b');
    expect(matchVote('4', opts)).toBeNull();
    expect(matchVote('astralis is the best team ever', opts)).toBeNull();
    expect(matchVote('lol', opts)).toBeNull();
  });
  it('takes one vote per viewer and breaks ties toward the first option', () => {
    const votes = new Map([['x', 'b'], ['y', 'c'], ['z', 'b']]);
    votes.set('z', 'c'); // changed their mind
    expect(tally(votes, opts)).toEqual([0, 1, 2]);
    expect(winner(votes, opts)).toBe('c');
    expect(winner(new Map([['x', 'c'], ['y', 'b']]), opts)).toBe('b');
    expect(winner(new Map(), opts)).toBeNull();
  });
  it('accepts only real channel names', () => {
    expect(validChannel('shroud')).toBe(true);
    expect(validChannel('a')).toBe(false);
    expect(validChannel('bad name')).toBe(false);
  });
});
