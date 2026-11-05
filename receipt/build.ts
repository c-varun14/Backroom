import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";

const patterns = () => [
 /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
 /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/g,
 /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
 /\b(?:mfa\.[\w-]{20,}|[\w-]{24,}\.[\w-]{6}\.[\w-]{25,})\b/g,
 /\bBearer\s+[^\s<>"']+/gi,
 /\b(?:password|passwd|secret|token|api[_-]?key|authorization|cookie)\s*[=:]\s*(?:"[^"\n]*"|'[^'\n]*')/gi,
 /\b(?:password|passwd|secret|token|api[_-]?key|authorization|cookie)\s*[=:]\s*["']?[^\s<>"'&,;]+/gi,
 /https?:\/\/[^\s/<>"']+:[^\s/<>"']+@[^\s<>"']+/gi,
 /[?&](?:access_token|token|key|api_key|password|secret|signature)=[^\s&#<>"']+/gi,
];
const sensitiveKey = /(?:password|passwd|secret|token|api[_-]?key|authorization|cookie|private[_-]?key|credential)/i;
export function scrub(value: unknown): unknown {
 if (typeof value === "string") { let s = value; for (const re of patterns()) s = s.replace(re, "[REDACTED]"); return s; }
 if (Array.isArray(value)) return value.map(scrub);
 if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [String(scrub(k)), sensitiveKey.test(k) ? "[REDACTED]" : scrub(v)]));
 return value;
}
export function assertClean(text: string) {
 // A redacted assignment is safe; scan after removing placeholders.
 const check = text.replaceAll("[REDACTED]", "");
 if (patterns().some(re => re.test(check))) throw new Error("Secret-shaped content remains; receipt refused");
}
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
function time(v: unknown): number | null {
 const n = typeof v === "number" ? v : typeof v === "string" ? Date.parse(v) : NaN;
 return Number.isFinite(n) ? n : null;
}
function human(id: unknown) { return typeof id === "string" && (/^@switch-member-[\w-]+:localhost$/.test(id) || /^user:[\w-]+$/.test(id)); }
function safeLink(v: unknown): string | null {
 if (typeof v !== "string") return null;
 try { const u = new URL(v); return ["http:","https:"].includes(u.protocol) && !u.username && !u.password && !v.includes("[REDACTED]") ? u.href : null; } catch { return null; }
}
export function buildReceipt(input: unknown): string {
 const cleaned = scrub(input); assertClean(JSON.stringify(cleaned));
 const events = Array.isArray(cleaned) ? cleaned : (cleaned as any)?.events;
 if (!Array.isArray(events)) throw new Error("Expected an event array or {events: []}");
 const rows: {at:number|null; html:string}[] = []; let humans = 0, agents = 0, unknown = 0, approvals = 0;
 const seen = new Set<string>();
 for (const e of events) {
  const d = e?.data ?? e; const p = d?.payload;
  if (p && (e.event === "message" || d.type === "message")) {
   const id = p.message_id; if (id && seen.has(id)) continue; if (id) seen.add(id);
   const isHuman = human(p.sender), isAgent = /^@switch-agent-/.test(p.sender ?? "");
   if (isHuman) humans++; else if (isAgent) agents++; else unknown++;
   const links = [...(p.attachments ?? []).map((a:any) => ({name:a.filename ?? "Attachment",url:a.url ?? a.mxc})), ...(p.links ?? []).map((url:string) => ({name:url,url}))];
   const linkHtml = links.map((a:any) => {const url = safeLink(a.url); return url ? `<a href="${esc(url)}" rel="noreferrer noopener">${esc(a.name)}</a>` : `<span>${esc(a.name)} (no public link)</span>`;}).join(" · ");
   const request = /^\s*(?:@desk\s+)?(?:send|deploy)\s+\S+\s*$/.test(p.body ?? "");
   rows.push({at:time(p.timestamp),html:`<p class="kind">${isHuman ? "Human" : isAgent ? "Agent" : "Unknown identity"}${request ? " · release request (outcome unverified)" : ""} · ${esc(d.room_id)}</p><h3>${esc(p.sender_name ?? p.sender)}</h3><p class="identity">${esc(p.sender)}</p><p class="body">${esc(p.body)}</p>${linkHtml ? `<p>${linkHtml}</p>` : ""}`});
  } else {
   const a = d?.native_approval_room_record ?? d?.approval ?? (d?.kind === "approval" ? d : null);
   if (!a) continue;
   const key = `approval:${a.requestId}:${a.state}:${a.answeredAt}`; if (seen.has(key)) continue; seen.add(key);
   const approved = a.state === "answered" && ["accept","acceptForSession"].includes(a.options?.find((o:any) => o.id === a.answer)?.decision) && human(a.answeredBy);
   if (approved) approvals++;
   const decision = a.options?.find((o:any) => o.id === a.answer)?.decision ?? a.answer ?? "pending";
   rows.push({at:time(a.answeredAt ?? a.timestamp),html:`<p class="kind">Native tool approval · ${approved ? "Approved" : esc(decision)} · ${esc(a.roomId)}</p><h3>${esc(a.title)}</h3><p>${esc(a.detail)}</p><p>Answered by: <strong>${esc(a.answeredBy ?? "Nobody yet")}</strong></p><p>Request: ${esc(a.requestId)} · Decision: ${esc(decision)}</p>`});
  }
 }
 rows.sort((a,b) => (a.at ?? Infinity)-(b.at ?? Infinity));
 const times = rows.flatMap(r => r.at === null ? [] : [r.at]);
 const elapsed = times.length > 1 ? `${((Math.max(...times)-Math.min(...times))/1000).toFixed(1)} seconds` : "Not available";
 const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Backroom run receipt</title><style>body{margin:0;background:#f7f5ef;color:#182c2a;font:16px/1.6 system-ui}main{max-width:780px;margin:auto;padding:32px 18px}h1{font-size:clamp(30px,7vw,48px);line-height:1.1}h2{margin-top:40px}h3,p{margin:.45em 0}.stats{display:flex;gap:20px;flex-wrap:wrap;padding:20px 0;border-block:1px solid #cad2ca}.stats strong{display:block;font-size:24px}ol{padding-left:22px}li{padding:16px 0 24px 12px;border-bottom:1px solid #cad2ca;overflow-wrap:anywhere}.kind,time,.identity{font-size:13px;color:#4b615b}.body{white-space:pre-wrap}a{color:#075b49}footer{margin-top:32px;font-size:14px}</style><main><p>BACKROOM · RUN RECEIPT</p><h1>Decisions, handoffs, evidence.</h1><p>Exported room activity. Identity and approval claims are only as trustworthy as the supplied export.</p><div class="stats"><div><strong>${humans}</strong>human messages</div><div><strong>${agents}</strong>agent messages</div><div><strong>${unknown}</strong>unknown messages</div><div><strong>${approvals}</strong>accepted tool approvals</div><div><strong>${esc(elapsed)}</strong>observed elapsed time</div></div><h2>Timeline</h2><ol>${rows.map(r => `<li><time>${r.at === null ? "Time not supplied" : new Date(r.at).toISOString()}</time>${r.html}</li>`).join("")}</ol><footer>Secret-shaped values are scrubbed before rendering. This page contains no login, scripts, trackers or external assets. Native tool approvals do not establish a desk send/deploy approval. Missing timestamps are excluded from elapsed time.</footer></main></html>`;
 assertClean(html); return html;
}
if (import.meta.main) {
 const [source, destination] = Bun.argv.slice(2);
 if (!source || !destination) throw new Error("Usage: bun receipt/build.ts export.json output.html");
 const html = buildReceipt(JSON.parse(await readFile(source,"utf8")));
 await mkdir(dirname(destination),{recursive:true}); await writeFile(destination,html);
 console.log(`Receipt written: ${destination}`);
}
