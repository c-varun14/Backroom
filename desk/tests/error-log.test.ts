import {expect, test} from 'bun:test';
import {errorWhere, logDeskError} from '../src/error-log';

test('desk errors name the type and desk source line, never the message', () => {
  // Live 2026-11-08: "desk error [poll]: operation failed" gave no way to find the cause.
  const error = new TypeError('token=fictional-secret at desk/src/fake.ts:999');
  error.stack = 'TypeError: token=fictional-secret at desk/src/fake.ts:999\n    at tick (/srv/backroom/desk/src/real-loop.ts:172:20)\n    at run (/srv/backroom/desk/src/main.ts:65:1)';
  expect(errorWhere(error)).toBe(' (TypeError at real-loop.ts:172)');
  const lines: string[] = [];
  const original = console.error;
  console.error = (line: string) => lines.push(line);
  try { logDeskError('poll', error); } finally { console.error = original; }
  expect(lines).toEqual(['desk error [poll]: operation failed (TypeError at real-loop.ts:172)']);
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
