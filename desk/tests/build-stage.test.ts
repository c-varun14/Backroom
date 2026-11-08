import {test, expect} from 'bun:test';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {inspectBuildHandoff} from '../src/build-stage';

test('shared handoff check reports all contract failures from workspace root', () => {
  const root = mkdtempSync('/tmp/backroom-handoff-');
  try {
    expect(inspectBuildHandoff({workspace: root, reportName:'build-report.md', criteria: ['AC-1'], bug: true, gitStatus: ' M app.ts'})).toEqual([
      // Report-content rules wait until the report exists, so the cause is not buried.
      'Missing build-report.md at the workspace root.',
      'Missing build-verification.json.',
      'Worktree is not clean.'
    ]);
    writeFileSync(join(root, 'build-report.md'), 'AC-1: PASS - bun test output\nReproduction test: regression.test.ts\n');
    writeFileSync(join(root, 'build-verification.json'), JSON.stringify({url: 'http://127.0.0.1:3210', screenshot: 'shot.png', sample: false}));
    writeFileSync(join(root, 'shot.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
    expect(inspectBuildHandoff({workspace: root, reportName:'build-report.md', criteria: ['AC-1'], bug: true, gitStatus: ''})).toEqual([]);
    expect(inspectBuildHandoff({workspace: root, reportName:'build-report.md', criteria: ['AC-2'], bug: false, gitStatus: ''})[0]).toContain('AC-2');
  } finally { rmSync(root, {recursive: true, force: true}); }
});

test('protected template files and skipped existing tests are rejected unless file scope is explicit', () => {
  const root = mkdtempSync('/tmp/backroom-protected-');
  try {
    writeFileSync(join(root, 'build-report.md'), 'AC-1: PASS - test output\n');
    writeFileSync(join(root, 'build-verification.json'), JSON.stringify({url:'http://127.0.0.1:3210',screenshot:'shot.png'}));
    writeFileSync(join(root, 'shot.png'), Buffer.from('89504e470d0a1a0a','hex'));
    const files = ['packages/db/test/migrate.test.ts'];
    const diff = '-test("AC-24 migration readiness", () => {});\n+test.skip("AC-24 migration readiness", () => {});';
    const failures = inspectBuildHandoff({workspace:root,reportName:'build-report.md',criteria:['AC-1'],bug:false,gitStatus:'',changedFiles:files,scopeText:'unrelated change',diffText:diff});
    expect(failures.some(value => value.includes('packages/db/test/migrate.test.ts'))).toBe(true);
    expect(failures.some(failure => failure.includes('Add a new test file or ask lead'))).toBe(true);
  } finally { rmSync(root, {recursive:true, force:true}); }
});

test('handoff evidence costs a fixed number of git calls, plus one read per protected file', async () => {
  // Live 2026-11-08: four git calls per changed file blocked desk for ~30s on a
  // 45-file change, Switch dropped every desk connection, and review never started.
  const {collectHandoffEvidence} = await import('../src/handoff-evidence');
  const base = 'a'.repeat(40), head = 'b'.repeat(40);
  const files = [...Array.from({length: 60}, (_, i) => `apps/web/src/file-${i}.ts`), 'packages/api/test/support/fixtures.ts'];
  const calls: string[][] = [];
  const git = (...args: string[]) => {
    calls.push(args);
    if (args[0] === 'rev-parse') return head;
    if (args[0] === 'diff' && args.includes('--name-only')) return files.join('\0') + '\0';
    if (args[0] === 'diff') return '';
    if (args[0] === 'ls-tree') return files.map((f, i) => `100644 blob ${(args.includes(base) ? 'c' : 'd').repeat(39)}${i % 10}\t${f}`).join('\0') + '\0';
    if (args[0] === 'show') return 'fictional fixture content';
    if (args[0] === 'status') return '';
    throw new Error('unexpected git ' + args.join(' '));
  };
  const evidence = collectHandoffEvidence({workspace: '/srv/fictional', base, scopeText: '', criteria: [], bug: false, generation: 1}, git);
  expect(evidence.sourceChanges).toHaveLength(61);
  expect(calls.length).toBeLessThanOrEqual(8);
  expect(calls.filter(c => c[0] === 'show')).toHaveLength(2);
  const fixture = evidence.sourceChanges.find(c => c.file.endsWith('fixtures.ts'))!;
  expect(fixture.before).toBe('fictional fixture content');
  expect(fixture.beforeOid).not.toBe(fixture.afterOid);
});
