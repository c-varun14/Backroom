import type {SourceChange} from './handoff-evidence';

const permissionPrefix = 'Test files allowed to change: ';

export function allowedTestFiles(spec: string): Set<string> {
  const lines = spec.split(/\r?\n/).filter(line => line.startsWith(permissionPrefix));
  if (lines.length !== 1) return new Set();
  const paths = lines[0].slice(permissionPrefix.length).split(', ');
  if (paths.some(path => !path || path !== path.trim() || /[\\\0<>*?\[\],]/.test(path) ||
      path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..'))) return new Set();
  return new Set(paths);
}

export function isTestFile(file: string): boolean {
  return /(?:^|\/)(?:tests?|__tests__)\/|\.(?:test|spec)\.[^/]+$|(?:^|\/)test_[^/]+\.py$|_(?:test|spec)\.py$/.test(file);
}

export function isProtectedFile(file: string): boolean {
  return isTestFile(file) || /^packages\/db\/test\//.test(file) ||
    /^\.github\/(?:workflows|actions)\//.test(file) || /^\.(?:circleci|buildkite)\//.test(file) ||
    ['.gitlab-ci.yml', 'azure-pipelines.yml', 'Jenkinsfile'].includes(file);
}

/** Existing protected files are immutable unless the one exact spec line grants
 * permission. No syntax normalization, parser or prose inference is involved. */
export function fileProtection(changedFiles: string[], changes: SourceChange[] | undefined, spec: string): string[] {
  const allowed = allowedTestFiles(spec);
  const failures: string[] = [];
  for (const file of changedFiles) {
    if (!isProtectedFile(file)) continue;
    const change = changes?.find(change => change.file === file);
    if (change) {
      const isNew = change.beforeOid === null || change.before === null;
      if (isNew && isTestFile(file)) continue;
      const identical = change.beforeOid && change.afterOid
        ? change.beforeOid === change.afterOid : change.before === change.after;
      if (!isNew && identical) continue;
      if (allowed.has(file)) continue;
    }
    failures.push(`Protected file change refused: ${file}. Add a new test file or ask lead to name this exact path on "${permissionPrefix}<path>, <path>".${change ? '' : ' Assignment-base file evidence is missing.'}`);
  }
  return failures;
}
