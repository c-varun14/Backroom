import {isProtectedFile} from './file-protection';
import {createHash, randomUUID} from 'node:crypto';
import {constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync, unlinkSync, fsyncSync, fchmodSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {realpathSync} from 'node:fs';
import {protectedGitSync} from './trusted-git';

export type HandoffContract = {workspace: string; base: string; scopeText: string; criteria: string[]; bug: boolean; generation: number};
export type GitRead = (...args: string[]) => string;
export type SourceChange = {file: string; before: string | null; after: string | null; beforeOid?: string|null; afterOid?:string|null};
const sha = /^[a-f0-9]{40}$/;

export function gitReader(workspace: string): GitRead {
  return (...args) => {
    const result = protectedGitSync(workspace, args);
    if (result.exitCode !== 0) throw new Error('Build evidence Git read failed.');
    return new TextDecoder().decode(result.stdout).trimEnd();
  };
}

export function contractPath(backroom: string, workspace: string) {
  return join(backroom, '.handoff-contracts', createHash('sha256').update(resolve(workspace)).digest('hex') + '.json');
}

export function saveHandoffContract(backroom: string, contract: HandoffContract) {
  const file = contractPath(backroom, contract.workspace);
  mkdirSync(join(backroom, '.handoff-contracts'), {recursive: true, mode: 0o750});
  const temporary = file + '.' + randomUUID() + '.tmp';
  const fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    writeFileSync(fd, JSON.stringify(contract));
    fchmodSync(fd, 0o440);
    fsyncSync(fd);
    renameSync(temporary, file);
  } finally {
    closeSync(fd);
    try { unlinkSync(temporary); } catch (error: any) { if(error.code!=='ENOENT')throw error; }
  }
}

export function loadHandoffContract(backroom: string, workspace: string): HandoffContract {
  const file = contractPath(backroom, workspace);
  const parent = lstatSync(join(backroom, '.handoff-contracts'));
  const info = lstatSync(file);
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o022) ||
      !info.isFile() || info.isSymbolicLink() || (info.mode & 0o022)) throw new Error('Trusted handoff contract unavailable.');
  const contract = JSON.parse(readFileSync(file, 'utf8'));
  if (contract.workspace !== resolve(workspace) || !sha.test(contract.base) || typeof contract.scopeText !== 'string' ||
      !Array.isArray(contract.criteria) || !contract.criteria.length || contract.criteria.some((c: unknown) => typeof c !== 'string' || !/^AC-[1-9][0-9]*$/.test(c)) ||
      typeof contract.bug !== 'boolean') throw new Error('Trusted handoff contract unavailable.');
  return contract;
}

/** Snapshot only the fixed report; refuse links and special files before reading. */
export function readBuildReport(workspace: string, name = 'build-report.md'): string | null {
  if (name !== 'build-report.md') return null;
  let fd: number | undefined;
  try {
    const file = join(realpathSync(workspace), name);
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(fd);
    if (!before.isFile() || before.nlink !== 1 || before.size > 2 * 1024 * 1024) return null;
    const content = readFileSync(fd, 'utf8');
    const after = fstatSync(fd);
    const current = lstatSync(file);
    if (before.ino !== current.ino || before.dev !== current.dev || current.isSymbolicLink() ||
        before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) return null;
    return content;
  } catch { return null; }
  finally { if (fd !== undefined) closeSync(fd); }
}

/** Exact trees, never a merge-base or a mutable remote-tracking ref. */
export function collectHandoffEvidence(contract: HandoffContract, git: GitRead = gitReader(contract.workspace), checkpoint?:string) {
  if (!sha.test(contract.base)) throw new Error('Trusted assignment base unavailable.');
  const head = checkpoint??git('rev-parse', '--verify', 'HEAD^{commit}').trim();
  if (!sha.test(head)) throw new Error('Exact build checkpoint unavailable.');
  const flags = ['--no-ext-diff', '--no-textconv', '--no-renames'];
  const changedFiles = git('diff', ...flags, '--name-only', '-z', contract.base, head, '--').split('\0').filter(Boolean);
  const diffText = git('diff', ...flags, '--unified=0', contract.base, head, '--');
  // Two tree listings instead of four git calls per file: on a 45-file change
  // the per-file calls blocked desk for ~30s and Switch dropped its connections.
  // Content is read only for protected files, the only rule that compares it.
  const tree = (commit: string) => {
    const entries = new Map<string, {mode: string; type: string; oid: string}>();
    for (const record of git('ls-tree', '-r', '-z', '--full-tree', commit).split('\0')) {
      const tab = record.indexOf('\t');
      if (tab < 0) continue;
      const [mode, type, oid] = record.slice(0, tab).split(' ');
      entries.set(record.slice(tab + 1), {mode, type, oid});
    }
    return entries;
  };
  const trees = {base: tree(contract.base), head: tree(head)};
  const sourceChanges: SourceChange[] = changedFiles.map(file => {
    const blob = (commit: string, entries: typeof trees.base) => {
      const entry = entries.get(file);
      if (!entry) return {content:null,oid:null};
      if (!/^100(?:644|755)$/.test(entry.mode) || entry.type !== 'blob' || !/^[a-f0-9]{40}$/.test(entry.oid)) throw new Error('Non-regular changed source refused.');
      return {content:isProtectedFile(file) ? git('show', `${commit}:${file}`) : null, oid:entry.oid};
    };
    const before=blob(contract.base,trees.base),after=blob(head,trees.head);
    return {file,before:before.content,after:after.content,beforeOid:before.oid,afterOid:after.oid};
  });
  return {changedFiles, diffText, sourceChanges, scopeText: contract.scopeText, gitStatus: git('status', '--porcelain')};
}
