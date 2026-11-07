import {createConnection} from 'node:net';

export type ProvisionResult = {ok: boolean; category: string; output: string};
export const provisionSocket = '/run/backroom-provision.sock';
const maxResponse = 20000;
const categories = new Set([
  'builder-prepared', 'doctor-passed', 'doctor-failed', 'doctor-timeout',
  'doctor-output-limit', 'invalid-request', 'unknown-operation', 'bad-project',
  'unsafe-path', 'unsafe-file', 'workspace-owner', 'workspace-changed',
  'shared-sandbox-policy', 'agent-config-conflict', 'caller-group', 'provision-failed',
  'agent-identity',
]);

export class ProvisionClient {
  constructor(private socketPath = provisionSocket, private timeoutMs = 190000) {}

  request(operation: 'prepare-builder' | 'doctor', project: string): Promise<ProvisionResult> {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(project) || project === 'shared') {
      return Promise.resolve({ok: false, category: 'bad-project', output: ''});
    }
    return new Promise(resolve => {
      const socket = createConnection(this.socketPath);
      const chunks: Buffer[] = [];
      let size = 0;
      let done = false;
      const finish = (result: ProvisionResult) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        socket.destroy();
        resolve(result);
      };
      const invalid = () => finish({ok: false, category: 'provision-unavailable', output: ''});
      const timer = setTimeout(invalid, this.timeoutMs);
      socket.on('connect', () => socket.write(JSON.stringify({operation, project}) + '\n'));
      socket.on('error', invalid);
      socket.on('end', () => { if (!done) invalid(); });
      socket.on('data', chunk => {
        size += chunk.length;
        if (size > maxResponse) return invalid();
        chunks.push(chunk);
        const response = Buffer.concat(chunks).toString('utf8');
        if (!response.includes('\n')) return;
        try {
          const result = JSON.parse(response.trim());
          if (typeof result.ok !== 'boolean' || !categories.has(result.category) ||
              typeof result.output !== 'string' || Buffer.byteLength(result.output) > 16384 ||
              (result.ok && result.category !== (operation === 'doctor' ? 'doctor-passed' : 'builder-prepared'))) {
            return invalid();
          }
          finish({ok: result.ok, category: result.category, output: result.output});
        } catch { invalid(); }
      });
    });
  }
}

export type HeldAssignment = {body: string; context: string};
/** Persistent hold/retry state is owned by desk; no assignment leaves on failure. */
export async function preflightAssignment(
  client: Pick<ProvisionClient, 'request'>, project: string, assignment: HeldAssignment,
  hooks: {hold: (assignment: HeldAssignment, result: ProvisionResult) => Promise<void>; send: () => Promise<void>},
): Promise<boolean> {
  const result = await client.request('doctor', project);
  if (!result.ok) {
    await hooks.hold(assignment, result);
    return false;
  }
  await hooks.send();
  return true;
}
