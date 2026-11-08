import {expect, test} from 'bun:test';
import {errorWhere, logDeskError} from '../src/error-log';
import {switchRoute} from '../src/switch-transport';

test('desk errors name the type and desk source line, never the message', () => {
  // Live 2026-11-08: "desk error [poll]: operation failed" gave no way to find the cause.
  const error = new TypeError('token=fictional-secret at desk/src/fake.ts:999');
  error.stack = 'TypeError: token=fictional-secret at desk/src/fake.ts:999\n    at tick (/srv/backroom/desk/src/real-loop.ts:172:20)\n    at run (/srv/backroom/desk/src/main.ts:65:1)';
  expect(errorWhere(error)).toBe(' (TypeError at real-loop.ts:172 < main.ts:65)');
  const lines: string[] = [];
  const original = console.error;
  console.error = (line: string) => lines.push(line);
  try { logDeskError('poll', error); } finally { console.error = original; }
  expect(lines).toEqual(['desk error [poll]: operation failed (TypeError at real-loop.ts:172 < main.ts:65)']);
  expect(lines[0]).not.toContain('fictional-secret');
  expect(lines[0]).not.toContain('fake.ts');
  expect(errorWhere('plain string')).toBe('');
});

test('desk errors keep the HTTP status code, which carries no secret', () => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (line: string) => lines.push(line);
  try { logDeskError('operation', new Error('Switch HTTP 409; response withheld')); } finally { console.error = original; }
  expect(lines[0]).toStartWith('desk error [operation]: remote service error (HTTP 409)');
});

test('Switch errors name the endpoint shape without ids or query', () => {
  expect(switchRoute('/gateway/rooms/206c5581-6b7e-4964-af40-57ec7b8384ed/messages?token=fictional')).toBe('/gateway/rooms/:id/messages');
  expect(switchRoute('/v1/threads/sw_0566fb2c41c958817d13d15a5a138bce/reply')).toBe('/v1/threads/:id/reply');
  expect(switchRoute('/agents/791d2810-a179-4333-a887-ec7b04f701fb/ops/load_internal_documents')).toBe('/agents/:id/ops/load_internal_documents');
  const lines: string[] = [];
  const original = console.error;
  console.error = (line: string) => lines.push(line);
  try { logDeskError('operation', new Error('Switch HTTP 409 POST /gateway/rooms/:id/messages; response withheld')); } finally { console.error = original; }
  expect(lines[0]).toStartWith('desk error [operation]: remote service error (HTTP 409 POST /gateway/rooms/:id/messages)');
});

test('a stage management failure keeps the setup script\'s own fixed line', () => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (line: string) => lines.push(line);
  try {
    logDeskError('poll', new Error('Real stage management failed: Real setup failed (KeyError); sensitive details withheld'));
    logDeskError('poll', new Error('Real stage management failed; details withheld'));
    logDeskError('poll', new Error('Real stage management failed: Switch POST /gateway/management/agents HTTP 422; error code invalid_definition; response withheld'));
  } finally { console.error = original; }
  expect(lines[0]).toStartWith('desk error [poll]: stage management failed: Real setup failed (KeyError); sensitive details withheld');
  expect(lines[1]).toStartWith('desk error [poll]: operation failed');
  expect(lines[2]).toStartWith('desk error [poll]: stage management failed: Switch POST /gateway/management/agents HTTP 422; error code invalid_definition');
});
