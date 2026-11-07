import {test, expect} from 'bun:test';
import {Store} from '../src/store';
import {OwnerCards} from '../src/owner-cards';

test('long owner card posts full text first and preserves each card shape', async () => {
  const store = new Store();
  const calls: string[] = [];
  const api = {
    async post(_room: string, body: string) { calls.push(`post:${body.length}`); },
    async json(_path: string, body: any) { calls.push(`card:${body.detail.length}:${body.options.length}:${body.questions.length}`); return {}; }
  } as any;
  try {
    const cards = new OwnerCards(store, api, {projectId:'sample',ownerId:'owner',studioRoomId:'studio'}, () => [], () => null, async () => {});
    const detail = 'x'.repeat(4100);
    await cards.offer('Blocked', detail, [{label:'Continue',command:'@desk blocked-continue'},{label:'Stop',command:'@desk blocked-stop'}]);
    await cards.offer('Info', detail, []);
    await cards.offer('Question', detail, [], undefined, false, [{id:'q',title:'Which?',prompt:'Which?',options:[]}]);
    expect(calls.filter(call => call === 'post:4100')).toHaveLength(3);
    const cardCalls = calls.filter(call => call.startsWith('card:'));
    expect(cardCalls).toHaveLength(3);
    expect(cardCalls.every(call => Number(call.split(':')[1]) <= 4000)).toBe(true);
    expect(cardCalls.map(call => call.split(':').slice(2).join(':'))).toEqual(['2:0','1:0','0:1']);
    expect(calls[0]).toBe('post:4100');
    expect(calls[2]).toBe('post:4100');
    expect(calls[4]).toBe('post:4100');
  } finally { store.close(); }
});
