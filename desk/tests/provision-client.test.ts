import {expect, test} from 'bun:test';
import {createServer, type Socket} from 'node:net';
import {mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {ProvisionClient, preflightAssignment, type ProvisionResult} from '../src/provision-client';
import {checkBuildHandoff} from '../src/build-stage';
import {RealStagesLoop, type RealConfig} from '../src/real-loop';
import {Store} from '../src/store';
import {SwitchTransport} from '../src/switch-transport';

async function socketFixture(
  handle: (socket: Socket, request: unknown) => void,
  run: (path: string) => Promise<void>,
) {
  const root = await mkdtemp('/tmp/backroom-provision-client-');
  const path = join(root, 'helper.sock');
  const sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.once('data', data => handle(socket, JSON.parse(data.toString())));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(path, resolve);
  });
  try { await run(path); }
  finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(root, {recursive: true, force: true});
  }
}

const failed: ProvisionResult = {
  ok: false, category: 'doctor-failed', output: 'FAIL bun — fix: install bun for the agent user\n',
};
const passed: ProvisionResult = {ok: true, category: 'doctor-passed', output: 'PASS bun\n'};

test('provision client sends only operation and slug; handles a fragmented real socket response', async () => {
  await socketFixture((socket, request) => {
    expect(request).toEqual({operation: 'doctor', project: 'sample'});
    const response = JSON.stringify(failed) + '\n';
    socket.write(response.slice(0, 8));
    setTimeout(() => socket.end(response.slice(8)), 5);
  }, async path => {
    expect(await new ProvisionClient(path).request('doctor', 'sample')).toEqual(failed);
  });
});

test('provision client refuses bad slugs before opening a socket', async () => {
  const client = new ProvisionClient('/tmp/nonexistent-provision-helper', 50);
  for (const slug of ['../other', 'shared', 'sample/../other', 'bad;id', '-bad', 'UPPER', 'x'.repeat(61)]) {
    expect((await client.request('doctor', slug)).category).toBe('bad-project');
  }
});

for (const [name, reply] of [
  ['oversized', 'x'.repeat(20001)],
  ['malformed', '{invalid}\n'],
  ['unknown category', JSON.stringify({ok: false, category: 'fictional-private-data', output: 'ignored'}) + '\n'],
  ['wrong success', JSON.stringify({ok: true, category: 'builder-prepared', output: ''}) + '\n'],
  ['large output', JSON.stringify({...failed, output: 'x'.repeat(17000)}) + '\n'],
] as const) {
  test(`provision client refuses ${name} response without exposing it`, async () => {
    await socketFixture(socket => socket.end(reply), async path => {
      expect(await new ProvisionClient(path).request('doctor', 'sample')).toEqual({ok: false, category: 'provision-unavailable', output: ''});
    });
  });
}

test('provision client times out a real connected but silent helper', async () => {
  await socketFixture(() => {}, async path => {
    expect((await new ProvisionClient(path, 30).request('doctor', 'sample')).category).toBe('provision-unavailable');
  });
});

test('assignment preflight holds exact failure and sends only after a successful check', async () => {
  const calls: string[] = [];
  const assignment = {body: 'Implement only the sample spec', context: 'sample-version-1'};
  const hooks = {
    hold: async (held: unknown, result: ProvisionResult) => {
      expect(held).toEqual(assignment); expect(result).toEqual(failed); calls.push('hold');
    },
    send: async () => { calls.push('send'); },
  };
  expect(await preflightAssignment({request: async () => failed}, 'sample', assignment, hooks)).toBe(false);
  expect(calls).toEqual(['hold']);
  expect(await preflightAssignment({request: async () => passed}, 'sample', assignment, hooks)).toBe(true);
  expect(calls).toEqual(['hold', 'send']);
});

test('.codex is always refused in a commit even when ticket scope explicitly names it', () => {
  const failures = checkBuildHandoff({
    criteria: [], bug: false, reportName: 'build-report.md', reportContent: '', verificationFailure: null,
    gitStatus: '', changedFiles: ['.codex/config.toml', 'nested/.codex/config.toml'], scopeText: 'Change .codex/config.toml and nested/.codex/config.toml',
  });
  expect(failures).toEqual(['Protected builder policy must never be committed: .codex/config.toml.', 'Protected builder policy must never be committed: nested/.codex/config.toml.']);
});

async function deskFixture(path: string, run: (loop: RealStagesLoop, store: Store, posts: string[], answer: () => Promise<void>, restart: () => {loop:RealStagesLoop;store:Store}) => Promise<void>) {
  const root=await mkdtemp('/tmp/backroom-dispatch-store-');
  let store = new Store(join(root,'desk.sqlite'));
  const config: RealConfig = {
    mode: 'real', projectId: 'sample', ownerId: 'owner', clientId: 'client', deskId: 'desk', leadId: 'lead',
    builderId: 'builder', reviewerId: 'reviewer', studioRoomId: 'studio', clientRoomId: 'client-room',
    workRoomId: 'work', bridgeId: 'bridge', workspace: '/srv/backroom/workspaces/sample',
    memoryDocumentId: 'memory', packageId: 'package', leadName: 'lead', builderName: 'builder', reviewerName: 'reviewer',
    provisionSocket: path,
  };
  const posts: string[] = [];
  let outcomes: unknown[] = [];
  const api: any = {
    socket: () => ({send() {}}),
    json: async (endpoint: string) => endpoint.endsWith('/outcomes') ? outcomes.splice(0) : {},
    post: async (_room: string, text: string) => { posts.push(text); return {event_id: 'message'}; },
  };
  const createLoop=()=>{const loop = new RealStagesLoop(store, api, new SwitchTransport(api, '/tmp/unused-provision-fixture'), config,
    {current: async () => null, deploy: async () => {}} as any,
    () => [{sender: 'owner', kind: 'human', agent_id: null, users: ['owner']},{sender:'desk',kind:'agent',agent_id:'desk',users:[]}],
    {freshReviewer: async () => ({id: 'reviewer', name: 'reviewer'}), promotePackage: async () => {}}, '/srv/backroom');
  (loop as any).git = () => '';return loop;};
  let loop=createLoop();
  const state = loop.state.get('sample');
  state.stage = 'build';
  store.db.query('UPDATE workflows SET state=? WHERE project=?').run(JSON.stringify(state), 'sample');
  const answer = async () => {
    const row: any = store.db.query("SELECT * FROM owner_cards WHERE status='open'").get();
    expect(row).toBeTruthy();
    const button = JSON.parse(row.buttons)[0];
    expect(button.label).toBe('Retry');
    outcomes = [{session_id: loop.brief.ownerCards.session, request_id: row.request,
      state: 'answered', answer: button.id, answeredBy: 'user:owner'}];
    await loop.brief.ownerCards.poll();
  };
  const restart=()=>{store.close();store=new Store(join(root,'desk.sqlite'));loop=createLoop();return {loop,store};};
  try { await run(loop, store, posts, answer, restart); }
  finally { store.close();await rm(root,{recursive:true,force:true}); }
}

test('desk holds assignments, deduplicates the owner card and Retry rechecks before sending', async () => {
  let result = failed;
  const requests: unknown[] = [];
  await socketFixture((socket, request) => {
    requests.push(request); socket.end(JSON.stringify(result) + '\n');
  }, async path => deskFixture(path, async (loop, store, posts, answer) => {
    await loop.mention('builder', 'Implement the approved sample spec.');
    await loop.mention('builder', 'Implement the approved sample spec.');
    expect(posts).toEqual([]);
    expect(store.db.query("SELECT count(*) AS n FROM owner_cards WHERE status='open'").get()).toEqual({n: 1});
    const row: any = store.db.query("SELECT payload FROM owner_cards WHERE status='open'").get();
    expect(JSON.parse(row.payload).detail).toBe(failed.output);
    await answer(); // Still failed: the replacement card must remain actionable.
    expect(posts).toEqual([]);
    expect(store.db.query("SELECT count(*) AS n FROM owner_cards WHERE status='open'").get()).toEqual({n: 1});
    result = passed;
    await answer();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatch(/^@builder Implement the approved sample spec\.\n\[Backroom assignment [a-f0-9]{64}\]$/);
    expect(loop.get('pendingBuilderAssignment')).toBeNull();
    expect(store.db.query("SELECT count(*) AS n FROM owner_cards WHERE status='open'").get()).toEqual({n: 0});
    expect(requests).toHaveLength(4);
    expect(requests.every((request: any) => request.operation === 'doctor' && request.project === 'sample')).toBe(true);
  }));
});

test('desk discards a stale held assignment on Retry', async () => {
  await socketFixture(socket => socket.end(JSON.stringify(failed) + '\n'), async path => {
    await deskFixture(path, async (loop, _store, posts, answer) => {
      await loop.mention('builder', 'Old assignment.');
      loop.set('assignmentGeneration', 'changed');
      // A typed verified-owner retry is also bounded to the current assignment.
      await (loop as any).ownerEvent({payload: {message_id: 'retry'}}, 'provision-retry');
      expect(posts).toEqual([]);
      expect(loop.get('pendingBuilderAssignment')).toBeNull();
    });
  });
});

test('desk does not release an assignment whose context changed during preflight', async () => {
  let finish: (() => void) | undefined;
  await socketFixture(socket => { finish = () => socket.end(JSON.stringify(passed) + '\n'); }, async path => {
    await deskFixture(path, async (loop, _store, posts) => {
      const assignment = loop.mention('builder', 'Now stale assignment.');
      while (!finish) await Bun.sleep(1);
      loop.set('assignmentGeneration', 'newer-generation');
      finish();
      await assignment;
      expect(posts).toEqual([]);
    });
  });
});

test('F5 rejected post retains durable work and a working Retry until delivery is recorded',async()=>{
  let result=failed;
  await socketFixture(socket=>socket.end(JSON.stringify(result)+'\n'),async path=>{
    await deskFixture(path,async(loop,store,posts,answer)=>{
      await loop.mention('builder','Deliver the approved sample assignment.');
      result=passed;
      const api=(loop as any).api;
      const original=api.post;
      api.post=async()=>{throw new Error('Switch HTTP 403; response withheld');};
      await answer();
      expect(loop.get('pendingBuilderAssignment').status).toBe('held');
      expect(store.db.query("SELECT count(*) AS n FROM owner_cards WHERE status='open'").get()).toEqual({n:1});
      expect(posts).toEqual([]);
      api.post=original;
      await answer();
      expect(posts).toHaveLength(1);
      expect(loop.get('pendingBuilderAssignment')).toBeNull();
      await loop.mention('builder','Deliver the approved sample assignment.');
      expect(posts).toHaveLength(1);
    });
  });
});

test('F5 unknown accepted response stays locked across real SQLite reopen and a verified echo confirms it',async()=>{
  await socketFixture(socket=>socket.end(JSON.stringify(passed)+'\n'),async path=>{
    await deskFixture(path,async(loop,_store,posts,answer,restart)=>{
      const api=(loop as any).api,original=api.post;
      api.post=async(...args:any[])=>{await original(...args);throw new Error('fictional response lost');};
      await loop.mention('builder','One durable assignment.');
      expect(posts).toHaveLength(1);
      expect(loop.get('pendingBuilderAssignment').status).toBe('sending');
      api.post=original;
      const reopened=restart();loop=reopened.loop;
      await (loop as any).resumeBuilderDispatch();
      await answer();
      expect(posts).toHaveLength(1);
      const echo={room_id:'work',payload:{sender:'owner',body:posts[0],message_id:'forged-receipt',attachments:[]}};
      await loop.handle(echo);
      expect(loop.get('pendingBuilderAssignment').status).toBe('sending');
      await loop.handle({...echo,payload:{...echo.payload,sender:'desk',message_id:'verified-receipt'}});
      expect(loop.get('pendingBuilderAssignment')).toBeNull();
      await loop.mention('builder','One durable assignment.');
      expect(posts).toHaveLength(1);
      expect(reopened.store.db.query("SELECT count(*) AS n FROM owner_cards WHERE status='open'").get()).toEqual({n:0});
    });
  });
});

test('F5 crash window after accepted post before receipt checkpoint never sends twice',async()=>{
  await socketFixture(socket=>socket.end(JSON.stringify(passed)+'\n'),async path=>{
    await deskFixture(path,async(loop,_store,posts,_answer,restart)=>{
      const set=loop.set.bind(loop);let interrupt=true;
      (loop as any).set=(key:string,value:any)=>{
        if(interrupt&&key.startsWith('builderDispatch:')&&value?.status==='delivered'){
          interrupt=false;throw new Error('fictional interrupted receipt checkpoint');
        }
        return set(key,value);
      };
      await loop.mention('builder','Crash-safe assignment.');
      expect(posts).toHaveLength(1);
      expect(loop.get('pendingBuilderAssignment').status).toBe('sending');
      loop=restart().loop;
      await (loop as any).resumeBuilderDispatch();
      await loop.mention('builder','Crash-safe assignment.');
      expect(posts).toHaveLength(1);
      await loop.handle({room_id:'work',payload:{sender:'desk',body:posts[0],message_id:'echo-after-restart',attachments:[]}});
      await loop.mention('builder','Crash-safe assignment.');
      expect(loop.get('pendingBuilderAssignment')).toBeNull();
      expect(posts).toHaveLength(1);
    });
  });
});

test('F5 recorded success survives cleanup interruption and concurrent mentions send once',async()=>{
  await socketFixture(socket=>socket.end(JSON.stringify(passed)+'\n'),async path=>{
    await deskFixture(path,async(loop,_store,posts,_answer,restart)=>{
      const close=(loop as any).closeProvisionCard.bind(loop);let interrupt=true;
      (loop as any).closeProvisionCard=async()=>{
        if(interrupt){interrupt=false;throw new Error('fictional cleanup interruption');}
        return close();
      };
      await loop.mention('builder','Already recorded assignment.');
      expect(loop.get('pendingBuilderAssignment').status).toBe('delivered');
      loop=restart().loop;
      await (loop as any).resumeBuilderDispatch();
      await loop.mention('builder','Already recorded assignment.');
      expect(loop.get('pendingBuilderAssignment')).toBeNull();
      expect(posts).toHaveLength(1);
      await Promise.all([loop.mention('builder','Concurrent new assignment.'),loop.mention('builder','Concurrent new assignment.')]);
      expect(posts).toHaveLength(2);
      expect(loop.get('pendingBuilderAssignment')).toBeNull();
      const id=/\[Backroom assignment ([a-f0-9]{64})\]/.exec(posts[1])![1];
      expect(loop.get('builderDispatch:'+id).status).toBe('delivered');
    });
  });
});
