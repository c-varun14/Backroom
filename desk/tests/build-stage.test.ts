import {test, expect} from 'bun:test';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {inspectBuildHandoff} from '../src/build-stage';

test('shared handoff check reports all contract failures from workspace root', () => {
  const root = mkdtempSync('/tmp/backroom-handoff-');
  try {
    expect(inspectBuildHandoff({workspace: root, reportName:'build-report.md', criteria: ['AC-1'], bug: true, gitStatus: ' M app.ts'})).toEqual([
      'Missing build-report.md at the workspace root.',
      'AC-1 must have exactly one "AC-1: PASS - <evidence>" line.',
      'Bug report must name a Reproduction test.',
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
