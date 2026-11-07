import policyPaths from '../harness/policy-paths.json';

/** Provider policy folders are harness data, so desk code stays provider-neutral. */
export function isPolicyPath(file: string): boolean {
  return file.split('/').some(part => policyPaths.includes(part));
}

export const isPolicyPart = (part: string): boolean => policyPaths.includes(part);
