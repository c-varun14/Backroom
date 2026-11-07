import {existsSync, readFileSync, realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {buildVerification} from './build-verification';
import {readBuildReport, type SourceChange} from './handoff-evidence';
import {isPolicyPath} from './policy-paths';
import {fileProtection} from './file-protection';

export type HandoffCheckInput = {
  criteria: string[];
  bug: boolean;
  reportName: string;
  reportContent: string | null;
  verificationFailure: string | null;
  gitStatus?: string;
  changedFiles?: string[];
  scopeText?: string;
  diffText?: string;
  sourceChanges?: SourceChange[];
};

export function formatHandoffFailures(failures: string[]): string {
  return `build-ready refused:\n${failures.map(failure => `FAIL: ${failure}`).join('\n')}`;
}

/** Pure implementation of every build-ready rule. */
export function checkBuildHandoff(input: HandoffCheckInput): string[] {
  const failures: string[] = [];
  if (input.reportName !== 'build-report.md') failures.push('Report path must be build-report.md at the workspace root.');
  if (input.reportContent === null) failures.push('Missing build-report.md at the workspace root.');
  const report = input.reportContent ?? '';
  const lines = report.split(/\r?\n/);
  for (const criterion of input.criteria) {
    const matches = lines.filter(line => line.startsWith(`${criterion}:`));
    if (matches.length !== 1 || !new RegExp(`^${criterion}: PASS - \\S.*$`).test(matches[0] ?? '')) {
      failures.push(`${criterion} must have exactly one "${criterion}: PASS - <evidence>" line.`);
    }
  }
  if (input.bug && !/^Reproduction test:\s*\S/im.test(report)) failures.push('Bug report must name a Reproduction test.');
  if (input.verificationFailure) failures.push(input.verificationFailure);
  if (input.gitStatus === undefined) failures.push('Unable to check clean worktree.');
  else if (input.gitStatus.trim()) failures.push('Worktree is not clean.');
  for (const file of input.changedFiles ?? []) {
    if (isPolicyPath(file)) {
      failures.push(`Protected builder policy must never be committed: ${file}.`);
      continue;
    }
  }
  failures.push(...fileProtection((input.changedFiles??[]).filter(file=>!isPolicyPath(file)), input.sourceChanges, input.scopeText??''));
  return failures;
}

/** Read workspace evidence, then apply the same pure contract used by desk. */
export function inspectBuildHandoff(input: Omit<HandoffCheckInput, 'reportContent'|'verificationFailure'> & {workspace:string;reportSnapshot?:string|null}): string[] {
  const root = realpathSync(input.workspace);
  const reportContent = input.reportSnapshot === undefined ? readBuildReport(root,input.reportName) : input.reportSnapshot;
  let verificationFailure: string | null = null;
  const manifest = resolve(root, 'build-verification.json');
  if (!existsSync(manifest)) verificationFailure = 'Missing build-verification.json.';
  else try { buildVerification(root, true); }
  catch (error) { verificationFailure = error instanceof Error ? error.message : 'Invalid build-verification.json.'; }
  return checkBuildHandoff({...input, reportContent, verificationFailure});
}
