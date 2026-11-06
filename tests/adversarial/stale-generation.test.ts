import {expect,test} from 'bun:test';
import {boundaryFixture} from './desk-boundary.test';
/** A late reply to an earlier client message must not freeze as the current revision. */
test('SECURITY P2: stale generation reply must not freeze as the newest ticket revision',async()=>{
 const f=boundaryFixture();
 await f.loop.handle(f.event('client','Request: allow forty fictional units.',f.config.clientRoomId));
 // The lead's first job is still in flight when a new client requirement arrives.
 await f.loop.handle(f.event('client','Request: replace capacity with twenty-four fictional units.',f.config.clientRoomId));
 expect(f.loop.latestTicket().generation).toBe(2);
 await f.loop.handle(f.event('lead',f.protocol(1,'We will allow forty units.')));
 // Avoid printing frozen bytes, generated IDs or private data in failure output.
 expect(Boolean(f.loop.latestDraft())).toBe(false);
});
