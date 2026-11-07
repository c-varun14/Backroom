import {expect, test} from 'bun:test';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, unlinkSync, copyFileSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {collectHandoffEvidence, gitReader, readBuildReport, saveHandoffContract, type HandoffContract} from '../src/handoff-evidence';
import {inspectBuildHandoff} from '../src/build-stage';
import {fileProtection} from '../src/file-protection';
import {workspaceFingerprint} from '../src/workspace-progress';
import {logDeskError} from '../src/error-log';
import {githubFixture} from './github-fixture';

async function realRepo(run: (root: string, repo: string, git: (...args: string[]) => string, checkpoint: () => string) => Promise<void>) {
  const root = mkdtempSync('/tmp/backroom-review-fix-');
  const repo = join(root, 'product');
  const home = join(root, 'home');
  mkdirSync(repo); mkdirSync(home);
  const oldHome = process.env.HOME; process.env.HOME = home;
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(['git', '-C', repo, ...args], {
      env: {PATH: process.env.PATH!, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_AUTHOR_NAME: 'Fictional Sample', GIT_AUTHOR_EMAIL: 'sample@example.invalid',
        GIT_COMMITTER_NAME: 'Fictional Sample', GIT_COMMITTER_EMAIL: 'sample@example.invalid'},
      stdout: 'pipe', stderr: 'pipe',
    });
    if (result.exitCode) throw new Error('Temporary Git fixture failed');
    return new TextDecoder().decode(result.stdout).trimEnd();
  };
  const checkpoint = () => {
    git('add', '.');
    const tree = git('write-tree');
    let parent: string | undefined;
    try { parent = git('rev-parse', '--verify', 'HEAD'); } catch {}
    const sha = git('commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', 'Fictional regression checkpoint');
    git('update-ref', 'refs/heads/main', sha);
    return sha;
  };
  try { git('init', '-q', '-b', 'main'); await run(root, repo, git, checkpoint); }
  finally { if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome; rmSync(root, {recursive:true, force:true}); }
}

function evidenceFiles(repo: string) {
  writeFileSync(join(repo, 'build-report.md'), 'AC-1: PASS - fictional form saved\n');
  writeFileSync(join(repo, 'screen.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  writeFileSync(join(repo, 'build-verification.json'), JSON.stringify({url:'http://127.0.0.1:3210', screenshot:'screen.png'}));
}

test('review 1: unsafe reproduction report is never forwarded; one safe snapshot is reused', async () => {
  const f = await githubFixture('bug');
  f.loop.set('ticketKind','bug');
  const outside = f.root + '-fictional.txt';
  writeFileSync(outside, 'cannot reproduce\nFICTIONAL_OUTSIDE_BYTES');
  unlinkSync(join(f.root, 'build-report.md'));
  symlinkSync(outside, join(f.root, 'build-report.md'));
  try {
    await f.loop.handle(f.event('builder', 'build-ready build-report.md'));
    expect([...f.documents.values()].some(value => value.includes('FICTIONAL_OUTSIDE_BYTES'))).toBe(false);
    expect(f.posts.some(post => post.text.includes('Missing build-report.md'))).toBe(true);
    expect(f.loop.get('buildReady')).not.toBe(true);
    unlinkSync(join(f.root, 'build-report.md'));
    writeFileSync(join(f.root, 'build-report.md'), 'AC-1: PASS - checked sample\nReproduction test: regression.test.ts\n');
    const snapshot = readBuildReport(f.root)!;
    writeFileSync(join(f.root, 'build-report.md'), 'different bytes');
    expect(inspectBuildHandoff({workspace:f.root,criteria:['AC-1'],bug:true,reportName:'build-report.md',gitStatus:'',reportSnapshot:snapshot})).toEqual([]);
    await f.loop.handle(f.event('builder', 'build-ready build-report.md'));
    const reproduction='cannot reproduce the fictional bug';
    writeFileSync(join(f.root, 'build-report.md'), reproduction);
    await f.loop.handle(f.event('builder', 'build-ready build-report.md'));
    expect([...f.documents.values()].some(value => value === reproduction)).toBe(true);
  } finally { rmSync(outside, {force:true}); }
});

test('review 2: assignment base is authenticated and retained across corrected specs', async () => {
  const f = await githubFixture();
  expect(f.loop.get('buildBase')).toBe(f.github.stats.base);
  expect(f.loop.get('buildBase')).not.toBe(f.sha());
  f.setSha('c'.repeat(40));
  const id = randomUUID(); f.documents.set(id, 'AC-1: Corrected bounded form spec.');
  await f.loop.handle(f.event('lead', `spec document ${id}`));
  expect(f.loop.get('buildBase')).toBe('a'.repeat(40));
});

test('review 2: fresh backroom ref works and tampering origin/main cannot hide exact-tree changes', async () => realRepo(async (_root, repo, git, checkpoint) => {
  writeFileSync(join(repo, 'app.ts'), 'export const sample = 1;');
  const base = checkpoint(); git('update-ref', 'refs/remotes/backroom/main', base);
  mkdirSync(join(repo, '.github/workflows'), {recursive:true});
  writeFileSync(join(repo, '.github/workflows/check.yml'), 'fictional workflow change');
  const head = checkpoint();
  const contract: HandoffContract = {workspace:repo,base,scopeText:'Only app.ts',criteria:['AC-1'],bug:false,generation:1};
  const first = collectHandoffEvidence(contract);
  expect(first.changedFiles).toContain('.github/workflows/check.yml');
  git('update-ref', 'refs/remotes/origin/main', head);
  expect(collectHandoffEvidence(contract).changedFiles).toEqual(first.changedFiles);
  const failures = inspectBuildHandoff({workspace:repo,reportName:'build-report.md',criteria:['AC-1'],bug:false,...first});
  expect(failures.some(failure=>failure.includes('Protected file change refused: .github/workflows/check.yml.'))).toBe(true);
  unlinkSync(join(repo,'.github/workflows/check.yml'));checkpoint();
  // Reviewer evidence follows its exact assigned candidate even if HEAD moves.
  expect(collectHandoffEvidence(contract,gitReader(repo),head).changedFiles).toContain('.github/workflows/check.yml');
}));

for (const [name, after] of [
  ['multiline skip', 'test.skip(\n "AC-24 migration", async () => {\n  expect(result.status).toBe(200);\n});'],
  ['Postgres early return', 'test(\n "AC-24 migration", async () => {\n  if (process.env.TEST_DATABASE_URL) return;\n  expect(result.status).toBe(200);\n});'],
  ['removed assertion', 'test(\n "AC-24 migration", async () => {\n});'],
  ['guard around declaration', 'if (!process.env.TEST_DATABASE_URL) {\ntest(\n "AC-24 migration", async () => {\n  expect(result.status).toBe(200);\n});\n}'],
] as const) {
  test(`review 3: ${name} cannot weaken an existing test outside scope`, () => {
    const before = 'test(\n "AC-24 migration", async () => {\n  expect(result.status).toBe(200);\n});';
    expect(fileProtection(['packages/api/system.test.ts'],[{file:'packages/api/system.test.ts',before,after}], 'Only change src/page.ts').length).toBeGreaterThan(0);
  });
}

test('strict file rule: additions to existing tests require the exact permission line; new files are allowed', () => {
  const before = 'test("old",()=>{expect(1).toBe(1)});';
  const change={file:'sample.test.ts',before,after:before+'\ntest("new",()=>{expect(2).toBe(2)});'};
  expect(fileProtection([change.file],[change], '')).toHaveLength(1);
  expect(fileProtection([change.file],[change], 'Test files allowed to change: sample.test.ts')).toEqual([]);
  expect(fileProtection(['new.test.ts'],[{file:'new.test.ts',before:null,after:'test("new",()=>{})'}], '')).toEqual([]);
});

test('review 6: actual main queue catches a rejection, redacts it and runs the next operation', async () => {
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  expect(source).toContain("import {logDeskError} from './error-log'");
  const code = source.slice(source.indexOf('function enqueue('), source.indexOf('function connect('));
  const javascript = new Bun.Transpiler({loader:'ts'}).transformSync(code);
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const lines: string[] = [];
  const original = console.error; console.error = value => { lines.push(String(value)); };
  try {
    const result = await new AsyncFunction('logDeskError', `let queue=Promise.resolve(),errors=0,ran=0;const health=()=>{};${javascript}\nenqueue(async()=>{throw Error('Bearer FICTIONAL_PRIVATE_MARKER')});await queue;enqueue(async()=>{ran++});await queue;return {errors,ran};`)(logDeskError);
    expect(result).toEqual({errors:1,ran:1});
    expect(lines).toHaveLength(1); expect(lines[0]).not.toContain('FICTIONAL_PRIVATE_MARKER');
  } finally { console.error = original; }
});

test('review 7: corrected assignment clears old blocks and distinct blocks return to lead', async () => {
  const f = await githubFixture();
  await f.loop.handle(f.event('builder', 'blocked: Browser unavailable'));
  const oldGeneration = f.loop.get('assignmentGeneration');
  const id = randomUUID(); f.documents.set(id, 'AC-1: Corrected sample spec.');
  await f.loop.handle(f.event('lead', `spec document ${id}`));
  expect(f.loop.get('builderBlock')).toBeNull();
  expect(f.loop.get('assignmentGeneration')).toBeGreaterThan(oldGeneration);
  const before = f.posts.length;
  await f.loop.handle(f.event('builder', 'blocked: Need owner budget decision'));
  expect(f.posts.slice(before).some(post => post.text.includes('Need owner budget decision'))).toBe(true);
  expect(f.loop.watchdog.current()?.role).toBe('lead');
  await f.loop.handle(f.event('lead', 'tell builder: Continue within approved budget.'));
  const next = f.posts.length;
  await f.loop.handle(f.event('builder', 'blocked: A different missing requirement'));
  expect(f.posts.slice(next).some(post => post.text.includes('Builder is blocked: A different missing requirement'))).toBe(true);
  expect(f.store.db.query("SELECT count(*) AS n FROM owner_cards WHERE status='open'").get()).toEqual({n:0});
  await f.loop.handle(f.event('lead', 'owner decision: Confirm the required budget.'));
  expect(f.store.db.query("SELECT count(*) AS n FROM owner_cards WHERE status='open'").get()).toEqual({n:1});
  const replacement=randomUUID();f.documents.set(replacement,'AC-1: Replace the approved sample assignment.');
  await f.loop.handle(f.event('lead',`spec document ${replacement}`));
  await f.loop.brief.ownerCards.closeStale();
  expect(f.loop.get('builderBlock')).toBeNull();
  expect(f.store.db.query("SELECT count(*) AS n FROM owner_cards WHERE status='open'").get()).toEqual({n:0});
});

test('review 7: duplicate block while lead is pending keeps the lead watchdog', async () => {
  const f = await githubFixture();
  await f.loop.handle(f.event('builder', 'blocked: Missing requirement'));
  const count = f.posts.length;
  await f.loop.handle(f.event('builder', 'blocked: Missing requirement'));
  expect(f.posts).toHaveLength(count);
  expect(f.loop.watchdog.current()?.role).toBe('lead');
  await f.loop.handle(f.event('builder','blocked: Different requirement while lead is pending'));
  expect(f.posts.length).toBeGreaterThan(count);
  expect(f.loop.get('builderBlock').reason).toBe('Different requirement while lead is pending');
});

test('review 8: actual CLI and desk give identical strict file refusals and exact-line permissions', async () => realRepo(async (root, repo, _git, checkpoint) => {
  evidenceFiles(repo);writeFileSync(join(repo,'sample.test.ts'),"const mode='test'; if(mode==='test'){test('sample',()=>{})}");
  const base = checkpoint();
  writeFileSync(join(repo,'sample.test.ts'),"const mode='te st'; if(mode==='test'){test('sample',()=>{})}");
  mkdirSync(join(repo, '.github/workflows'), {recursive:true});
  writeFileSync(join(repo, '.github/workflows/ci.yml'), 'fictional CI change'); checkpoint();
  const backroom = join(root, 'backroom');
  for (const relative of ['studio-kit/tools/handoff-check.ts','desk/src/handoff-evidence.ts','desk/src/build-stage.ts','desk/src/file-protection.ts','desk/src/policy-paths.ts','desk/harness/policy-paths.json','desk/src/build-verification.ts','desk/src/trusted-git.ts','scripts/shadow_git.py']) {
    const target = join(backroom, relative); mkdirSync(dirname(target), {recursive:true}); copyFileSync(resolve(import.meta.dir, '../..', relative), target);
  }
  const contract: HandoffContract = {workspace:repo,base,scopeText:'Only app.ts. Do not modify sample.test.ts.',criteria:['AC-1'],bug:false,generation:1};
  saveHandoffContract(backroom, contract);
  const expected = inspectBuildHandoff({workspace:repo,reportName:'build-report.md',criteria:contract.criteria,bug:false,...collectHandoffEvidence(contract)});
  const run = () => Bun.spawnSync([process.execPath, '--no-env-file', join(backroom, 'studio-kit/tools/handoff-check.ts'), 'AC-999'], {cwd:repo,env:{...process.env},stdout:'pipe',stderr:'pipe'});
  const cli = run(); expect(cli.exitCode).toBe(1);
  const output = new TextDecoder().decode(cli.stderr);
  for (const failure of expected) expect(output).toContain(failure);
  expect(output).toContain('Protected file change refused: .github/workflows/ci.yml.');
  expect(output).toContain('Protected file change refused: sample.test.ts.');
  const permitted={...contract,scopeText:'Test files allowed to change: .github/workflows/ci.yml, sample.test.ts'};
  saveHandoffContract(backroom,permitted);
  expect(inspectBuildHandoff({workspace:repo,reportName:'build-report.md',criteria:permitted.criteria,bug:false,...collectHandoffEvidence(permitted)})).toEqual([]);
  expect(run().exitCode).toBe(0);
  rmSync(join(backroom,'.handoff-contracts'),{recursive:true});
  expect(new TextDecoder().decode(run().stderr)).toContain('Trusted handoff contract or exact-tree evidence unavailable');
}));

test('review 9: real repeated dirty edits and edits inside untracked directories change fingerprints', async () => realRepo(async (_root, repo, _git, checkpoint) => {
  writeFileSync(join(repo,'app.ts'),'original'); checkpoint();
  writeFileSync(join(repo,'app.ts'),'first edit'); const first = workspaceFingerprint(repo);
  writeFileSync(join(repo,'app.ts'),'second edit'); expect(workspaceFingerprint(repo)).not.toBe(first);
  mkdirSync(join(repo,'untracked')); writeFileSync(join(repo,'untracked/new.ts'),'first');
  const untracked = workspaceFingerprint(repo);
  writeFileSync(join(repo,'untracked/new.ts'),'second'); expect(workspaceFingerprint(repo)).not.toBe(untracked);
}));

test('review 9: continuing dirty-file edits close the warning and reset real loop progress', async () => {
  const f = await githubFixture();
  await realRepo(async (_root, repo, _git, checkpoint) => {
    writeFileSync(join(repo,'app.ts'),'original'); checkpoint();
    // Use the real repository's content reader while preserving this loop's
    // isolated API/store fixture and its actual warning-card implementation.
    f.loop.real.workspace = repo; (f.loop as any).git = gitReader(repo);
    writeFileSync(join(repo,'app.ts'),'first');
    await f.loop.mention(f.loop.real.builderName,'Continue the approved task.');
    await f.loop.card('build','builder has made no progress within the configured time. Check the assignment.');
    f.store.db.query('UPDATE watchdog SET progress=0,warned=1').run();
    writeFileSync(join(repo,'app.ts'),'second');
    await f.loop.tick();
    expect(f.loop.watchdog.current()!.progress).toBeGreaterThan(0);
    expect(f.store.db.query("SELECT count(*) AS n FROM owner_cards WHERE status='open'").get()).toEqual({n:0});
  });
});
