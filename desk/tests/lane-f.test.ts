import {expect, test} from 'bun:test';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, statSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {allowedTestFiles, fileProtection} from '../src/file-protection';
import {checkBuildHandoff} from '../src/build-stage';
import {contractPath, saveHandoffContract, type HandoffContract} from '../src/handoff-evidence';

const file='sample.test.ts';
const before="const mode='test'; if(mode==='test'){test('AC-24',()=>{expect(true).toBe(true)})}";
const after=before.replace("mode='test'", "mode='te st'");

test('F3 literal whitespace and semicolon changes are byte changes, never normalized permissions',()=>{
  for(const after of [before.replace("mode='test'", "mode='te st'"),before.replace("mode='test'", "mode='te;st'"), before+'\n']){
    const failures=fileProtection([file],[{file,before,after}],'Only change src/page.ts');
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(file);
    expect(failures[0]).toContain('Add a new test file or ask lead');
  }
  expect(fileProtection([file],[{file,before,after:before}], '')).toEqual([]);
});

test('F4 only one exact positive permission line authorizes existing protected files',()=>{
  const change={file,before,after};
  for(const prose of [
    'Only change src/page.ts. Do not modify sample.test.ts.',
    'For example: Test files allowed to change: sample.test.ts',
    ' Test files allowed to change: sample.test.ts',
    'Test files allowed to change: *.test.ts',
    'Test files allowed to change: ../sample.test.ts',
    'Test files allowed to change: sample.test.ts\nTest files allowed to change: other.test.ts',
  ])expect(fileProtection([file],[change],prose)).toHaveLength(1);
  const spec='Only the bounded ticket.\nTest files allowed to change: sample.test.ts, packages/db/test/database.ts\nAC-1: Verify the result.';
  expect(allowedTestFiles(spec)).toEqual(new Set([file,'packages/db/test/database.ts']));
  expect(fileProtection([file],[change],spec)).toEqual([]);
});

test('F3/F4 new test files are allowed while existing CI, DB helpers and tests require the exact line',()=>{
  expect(fileProtection(['new.test.ts'],[{file:'new.test.ts',before:null,after:'test("new",()=>{})'}], '')).toEqual([]);
  for(const file of ['.github/workflows/ci.yml','packages/db/test/database.ts','test/example.py','example.spec.ts']){
    const change={file,before:'original bytes',after:'different bytes'};
    expect(fileProtection([file],[change],`Do not change ${file}.`)).toHaveLength(1);
    expect(fileProtection([file],[change],`Test files allowed to change: ${file}`)).toEqual([]);
  }
});

test('F3 raw Git object identities protect non-UTF8 bytes even when text decoding is identical',()=>{
  const change={file,before:'replacement character',after:'replacement character',beforeOid:'a'.repeat(40),afterOid:'b'.repeat(40)};
  expect(fileProtection([file],[change],'')).toHaveLength(1);
});

test('F4 full handoff still refuses a prohibition naming a changed test file',()=>{
  const failures=checkBuildHandoff({criteria:['AC-1'],bug:false,reportName:'build-report.md',reportContent:'AC-1: PASS - sample check',verificationFailure:null,gitStatus:'',changedFiles:[file],sourceChanges:[{file,before,after}],scopeText:'Only src/page.ts. Do not modify sample.test.ts.'});
  expect(failures).toHaveLength(1);
  expect(failures[0]).toContain('Protected file change refused: sample.test.ts.');
});

test('F9 read-only orphan temporaries cannot prevent a new contract from being saved',()=>{
  const root=mkdtempSync('/tmp/backroom-f-contract-');
  const workspace=join(root,'workspace');mkdirSync(workspace);
  const contract:HandoffContract={workspace,base:'a'.repeat(40),scopeText:'sample scope',criteria:['AC-1'],bug:false,generation:1};
  const file=contractPath(root,workspace);
  mkdirSync(join(root,'.handoff-contracts'),{mode:0o750});
  writeFileSync(file+'.tmp','fictional old read-only orphan',{mode:0o440});
  writeFileSync(file+'.orphan.tmp','fictional unique read-only orphan',{mode:0o440});
  try{
    saveHandoffContract(root,contract);
    saveHandoffContract(root,{...contract,generation:2});
    expect(JSON.parse(readFileSync(file,'utf8')).generation).toBe(2);
    expect(statSync(file).mode&0o777).toBe(0o440);
    expect(readFileSync(file+'.tmp','utf8')).toBe('fictional old read-only orphan');
    expect(readdirSync(join(root,'.handoff-contracts')).sort()).toEqual([file.split('/').at(-1)!,file.split('/').at(-1)!+'.orphan.tmp',file.split('/').at(-1)!+'.tmp'].sort());
  }finally{rmSync(root,{recursive:true,force:true});}
});
