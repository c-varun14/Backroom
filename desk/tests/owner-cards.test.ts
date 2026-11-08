import {test, expect} from 'bun:test';
import {Store} from '../src/store';
import {CARD_DETAIL_LIMIT, OwnerCards} from '../src/owner-cards';

test('long owner card posts full text first and preserves each card shape', async () => {
  const store = new Store();
  const calls: string[] = [];
  const api = {
    async post(_room: string, body: string) { calls.push(`post:${body.length}`); },
    async json(_path: string, body: any) { calls.push(`card:${body.detail.length}:${body.options.length}:${body.questions.length}`); return {}; }
  } as any;
  try {
    const cards = new OwnerCards(store, api, {projectId:'sample',ownerId:'owner',studioRoomId:'studio'}, () => [], () => null, async () => {});
    const detail = 'x'.repeat(1300);
    await cards.offer('Blocked', detail, [{label:'Continue',command:'@desk blocked-continue'},{label:'Stop',command:'@desk blocked-stop'}]);
    await cards.offer('Info', detail, []);
    await cards.offer('Question', detail, [], undefined, false, [{id:'q',title:'Which?',prompt:'Which?',options:[]}]);
    expect(calls.filter(call => call === 'post:1300')).toHaveLength(3);
    const cardCalls = calls.filter(call => call.startsWith('card:'));
    expect(cardCalls).toHaveLength(3);
    expect(cardCalls.every(call => Number(call.split(':')[1]) <= CARD_DETAIL_LIMIT)).toBe(true);
    expect(cardCalls.map(call => call.split(':').slice(2).join(':'))).toEqual(['2:0','1:0','0:1']);
    expect(calls[0]).toBe('post:1300');
    expect(calls[2]).toBe('post:1300');
    expect(calls[4]).toBe('post:1300');
  } finally { store.close(); }
});

test('a card at the Discord-safe limit stays whole; one character more moves the text above', async () => {
  // Live 2026-11-08: a 1700-character decision card lost its buttons on Discord.
  const store = new Store();
  const posts: number[] = [], cards: number[] = [];
  const api = {async post(_room: string, body: string) { posts.push(body.length); },
    async json(_path: string, body: any) { cards.push(body.detail.length); return {}; }} as any;
  try {
    const owner = new OwnerCards(store, api, {projectId:'sample',ownerId:'owner',studioRoomId:'studio'}, () => [], () => null, async () => {});
    await owner.offer('Fits', 'y'.repeat(CARD_DETAIL_LIMIT), [{label:'Continue',command:'@desk blocked-continue'}]);
    await owner.offer('Long', 'z'.repeat(CARD_DETAIL_LIMIT + 1), [{label:'Continue',command:'@desk blocked-continue'}]);
    expect(posts).toEqual([CARD_DETAIL_LIMIT + 1]);
    expect(cards[0]).toBe(CARD_DETAIL_LIMIT);
    expect(cards[1]).toBeLessThanOrEqual(CARD_DETAIL_LIMIT);
    expect(CARD_DETAIL_LIMIT).toBeLessThanOrEqual(1200);
  } finally { store.close(); }
});
