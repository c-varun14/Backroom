import {createHash} from 'node:crypto';
import {closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readlinkSync, realpathSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {gitReader, type GitRead} from './handoff-evidence';
import {isPolicyPart} from './policy-paths';

/** Hash tracked and untracked file bytes, including files within dirty directories. */
export function workspaceFingerprint(workspace: string, git: GitRead = gitReader(workspace)): string {
  const root = realpathSync(workspace);
  const hash = createHash('sha256');
  hash.update(git('rev-parse', 'HEAD')).update('\0').update(git('status', '--porcelain'));
  const files = [...new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean))].sort();
  for (const file of files) {
    const parts = file.split('/');
    if (parts.some(part => ['.git', '.secrets', '..'].includes(part) || isPolicyPart(part)) || parts.some(part => /^\.env(?:\.|$)/.test(part))) continue;
    const path = resolve(root, file);
    if (!path.startsWith(root + '/')) throw new Error('Invalid workspace progress path');
    hash.update('\0' + file + '\0');
    let fd: number | undefined;
    try {
      const parent = realpathSync(dirname(path));
      if (parent !== root && !parent.startsWith(root + '/')) throw new Error('Invalid workspace progress path');
      const info = lstatSync(path);
      if (info.isSymbolicLink()) { hash.update(readlinkSync(path)); continue; }
      fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const actual = fstatSync(fd);
      if (!actual.isFile() || actual.nlink !== 1 || actual.size > 64 * 1024 * 1024) throw new Error('Invalid workspace progress file');
      hash.update(readFileSync(fd));
    } catch (error: any) {
      if (error.code === 'ENOENT') hash.update('missing');
      else throw error;
    } finally { if (fd !== undefined) closeSync(fd); }
  }
  return hash.digest('hex');
}
