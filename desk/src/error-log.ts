const safeDetail = (value: unknown) => {
  const raw = value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  if (/timeout|timed out|ETIMEDOUT/i.test(raw)) return 'operation timed out';
  if (/ECONN|network|fetch failed|connection reset/i.test(raw)) return 'network unavailable';
  if (/HTTP 5\d\d|\b5\d\d\b/i.test(raw)) return 'remote service error';
  if (/invalid|malformed|parse/i.test(raw)) return 'invalid response or input';
  if (/permission|refused|unauthori[sz]ed|forbidden/i.test(raw)) return 'operation refused';
  return 'operation failed';
};

/** Error type and the innermost desk source line only: never message text,
 * arguments or values, which may carry credentials or client words. */
export const errorWhere = (value: unknown) => {
  if (!(value instanceof Error)) return '';
  const frame = (value.stack ?? '').split('\n').slice(1).map(line => /desk\/src\/([\w.-]+\.ts):(\d+)/.exec(line)).find(Boolean);
  const name = /^[A-Za-z]{1,40}$/.test(value.name) ? value.name : 'Error';
  return ` (${name}${frame ? ' at ' + frame[1] + ':' + frame[2] : ''})`;
};

export function logDeskError(category: 'operation'|'poll'|'startup'|'intake'|'recovery', detail: unknown) {
  console.error(`desk error [${category}]: ${safeDetail(detail)}${errorWhere(detail)}`);
}
