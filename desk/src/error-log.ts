const safeDetail = (value: unknown) => {
  const raw = value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  if (/timeout|timed out|ETIMEDOUT/i.test(raw)) return 'operation timed out';
  if (/ECONN|network|fetch failed|connection reset/i.test(raw)) return 'network unavailable';
  const status = /\bHTTP (\d{3})\b/.exec(raw)?.[1];
  if (status) return `remote service error (HTTP ${status})`;
  if (/\b5\d\d\b/i.test(raw)) return 'remote service error';
  if (/invalid|malformed|parse/i.test(raw)) return 'invalid response or input';
  if (/permission|refused|unauthori[sz]ed|forbidden/i.test(raw)) return 'operation refused';
  return 'operation failed';
};

/** Error type and the innermost desk source line only: never message text,
 * arguments or values, which may carry credentials or client words. */
export const errorWhere = (value: unknown) => {
  if (!(value instanceof Error)) return '';
  const frames = (value.stack ?? '').split('\n').slice(1)
    .map(line => /desk\/src\/([\w.-]+\.ts):(\d+)/.exec(line)).filter(Boolean).slice(0, 3)
    .map(frame => frame![1] + ':' + frame![2]);
  const name = /^[A-Za-z]{1,40}$/.test(value.name) ? value.name : 'Error';
  return ` (${name}${frames.length ? ' at ' + frames.join(' < ') : ''})`;
};

export function logDeskError(category: 'operation'|'poll'|'startup'|'intake'|'recovery', detail: unknown) {
  console.error(`desk error [${category}]: ${safeDetail(detail)}${errorWhere(detail)}`);
}
