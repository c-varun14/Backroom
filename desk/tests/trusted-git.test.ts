import {test,expect} from 'bun:test';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

test('protected Git runs real malicious config and replace-ref regressions',()=>{
  const script=fileURLToPath(new URL('../../scripts/repro/test-shadow-git.py',import.meta.url));
  const result=Bun.spawnSync(['python3',script],{stdout:'pipe',stderr:'pipe'});
  expect(new TextDecoder().decode(result.stderr)).toContain('Ran 3 tests');
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
