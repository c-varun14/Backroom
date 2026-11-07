import {test,expect} from 'bun:test';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

test('protected Git runs real malicious config and replace-ref regressions',()=>{
  const script=fileURLToPath(new URL('../../scripts/repro/test-shadow-git.py',import.meta.url));
  const result=Bun.spawnSync(['python3',script],{stdout:'pipe',stderr:'pipe'});
  const output=new TextDecoder().decode(result.stderr);
  expect(output).toMatch(/Ran \d+ tests/);
  for(const name of ['test_gitlink_fsmonitor_is_refused_before_worktree_operations',
    'test_export_stays_private_and_never_traverses_after_publication',
    'test_export_atomically_refuses_destination_planted_at_publication'])expect(output).toContain(name);
  expect(result.exitCode).toBe(0);
});

test('desk review and deploy entry points retain the protected Git boundary',()=>{
  for(const name of ['real-loop','stages-loop']){
    const text=readFileSync(new URL(`../src/${name}.ts`,import.meta.url),'utf8');
    expect(text).toContain('protectedGitSync');
    expect(text).not.toMatch(/Bun\.spawn(?:Sync)?\(\[['"]git/);
  }
  for(const name of ['nix-deployer','local-compose']){
    const text=readFileSync(new URL(`../../deploy/${name}.ts`,import.meta.url),'utf8');
    expect(text).toContain('protectedCommand');
  }
});
