import {expect, test} from 'bun:test';
import {Store} from '../src/store';
import {EventJournal} from '../src/event-journal';

const message = (extra: object = {}, payload: object = {}) => ({type: 'message', room_id: 'work', sequence: 1, ...extra,
  payload: {message_id: 'm1', thread_id: 't', sender: 'builder', body: 'build-ready build-report.md', addressed: false, ...payload}});

test('a failed message is retried when it is redelivered with different transport fields', async () => {
  // Live 2026-11-08: build-ready failed once, and every redelivery then threw
  // "Event identity conflict", so the retry could never run.
  const store = new Store();
  try {
    const journal = new EventJournal<any>(store, 'real:sample');
    let runs = 0;
    await expect(journal.run('m1', message(), async () => { runs++; throw new Error('Switch HTTP 502'); })).rejects.toThrow('Switch HTTP 502');
    await journal.run('m1', message({sequence: 7}, {addressed: true}), async () => { runs++; });
    expect(runs).toBe(2);
    await journal.run('m1', message({sequence: 9}), async () => { runs++; });
    expect(runs).toBe(2);
  } finally { store.close(); }
});

test('the same id with a different body, sender or room is still a conflict', async () => {
  const store = new Store();
  try {
    const journal = new EventJournal<any>(store, 'real:sample');
    await journal.run('m1', message(), async () => {});
    for (const changed of [message({}, {body: 'deploy now'}), message({}, {sender: 'someone-else'}), message({room_id: 'studio'})])
      await expect(journal.run('m1', changed, async () => {})).rejects.toThrow('Event identity conflict');
    await journal.run('x1', {type: 'tick', n: 1}, async () => {});
    await expect(journal.run('x1', {type: 'tick', n: 2}, async () => {})).rejects.toThrow('Event identity conflict');
  } finally { store.close(); }
});
