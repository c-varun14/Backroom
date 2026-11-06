/** Deliberately conservative: false blocks are safer than internal-text leaks. */
export const LEAK_GUARD = [
  ...["lead", "desk", "builder", "reviewer", "agent", "Claude", "Codex", "GPT", "AI", "Switch", "awaiting-owner", "frozen", "draft code", "owner approval", "untrusted"]
    .map(word => ({ word, pattern: new RegExp(`\\b${word.replace(/ /g, "\\s+")}\\b`, "i") })),
  { word: "Stage [0-9]", pattern: /\bstage\s+[0-9]+\b/i },
  { word: "--- protocol marker", pattern: /---/ },
  { word: "@ mention", pattern: /@/ },
];
export function leakWord(text: string): string | undefined {
  return LEAK_GUARD.find(rule => rule.pattern.test(text))?.word;
}
export interface LeadDraft { ticket: number; rev?: number; messageId?:number; kind: "reply" | "brief"; clientText: string; internalNotes: string }
export function parseLeadDraft(body: string): LeadDraft | undefined {
  const normal = body.replace(/\r\n/g, "\n");
  const message=/^draft message ([1-9][0-9]*)\n/.exec(normal);
  const match = /^draft ([1-9][0-9]*)(?: rev ([1-9][0-9]*))?\nKIND: (reply|brief)\n---CLIENT TEXT---\n([\s\S]*?)\n---INTERNAL NOTES---(?:\n([\s\S]*))?$/.exec(message?normal.replace(/^draft message /,"draft "):normal);
  if (!match || !Number.isSafeInteger(Number(match[1])) || normal.split("---CLIENT TEXT---").length !== 2 || normal.split("---INTERNAL NOTES---").length !== 2) return;
  const clientText = match[4].trim();
  if (match[3] === "brief" && !clientText) return;
  return { ticket: Number(match[1]), ...(match[2]?{rev:Number(match[2])}:{}), ...(message?{messageId:Number(match[1])}:{}),kind: match[3] as LeadDraft["kind"], clientText, internalNotes: (match[5] ?? "").trim() };
}
/** Display-only quoting; never use to construct release bytes. */
export const neutralise = (text: string) => text.replace(/@/g, "＠");
const clip = (text: string, max: number) => text.length <= max ? text : text.slice(0, max - 1) + "…";
const oneLine = (text: string) => neutralise(text).replace(/[\r\n\t]+/g, " ");
export const projectName = (id: string) => id === "morrowcrumb" ? "Morrowcrumb" : clip(oneLine(id), 60);
export function lineCard(ticket: number, text: string, icon = "🔵") { return clip(`${icon} Ticket #${ticket} · ${oneLine(text)}`, 900); }
export function blockedCard(ticket: number, reason: string) { return lineCard(ticket, `draft blocked: ${reason}`, "⚠️"); }
export function approvalCard(input: { ticket: number; project: string; clientText: string; reply: string; code: string; replacement?: boolean; simulated?: boolean; workRoom?: boolean; stage?: import("./types").Stage }) {
  const stage = input.stage ?? "brief";
  const heading = `🟡 Ticket #${input.ticket} · ${projectName(input.project)} · ${stageLabel(stage)} · needs your OK`;
  const context = input.replacement ? "\nnew client message, replaces the earlier draft" : "";
  const simulated = input.simulated ? "\nSIMULATION · cannot be sent" : "";
  const client = clip(oneLine(input.clientText), 140).replace(/"/g, "”");
  const footer = input.simulated ? "\n\n✏️ Change it: type what to change here." : `\n\n✅ Send it: @desk send ${input.code}\n✏️ Change it: type what to change here.`;
  const thread = "… full outgoing text attached and numbered above";
  const prefix = `${heading}${context}${simulated}\nClient said: "${client}"\n\nReply to send:\n`;
  const budget = Math.max(0, 900 - prefix.length - footer.length - thread.length - 5);
  let quote = input.reply.split("\n").map(line => `> ${neutralise(line)}`).join("\n");
  if (quote.length > budget) quote = `${quote.slice(0, budget)}\n${thread}`;
  return `${prefix}${quote}${footer}`;
}

const stageNames = {brief:"Brief",architecture:"Architecture",build:"Build",client_review:"Client review",video:"Video",learn:"Learn"};
export function stageLabel(stage: import("./types").Stage) {
  return `Stage ${Object.keys(stageNames).indexOf(stage) + 1} of 6: ${stageNames[stage]}`;
}
export function stageCard(ticket: number, project: string, stage: import("./types").Stage, summary: string, command: string, icon = "🟡") {
  if (!/^@desk [^\r\n]+$/.test(command)) throw new Error("Exact desk command required");
  const footer = `\n\nNext: ${command}\n✏️ Change it: type what to change here.`;
  const prefix = `${icon} Ticket #${ticket} · ${projectName(project)} · ${stageLabel(stage)}\n`;
  return prefix + clip(oneLine(summary), 900 - prefix.length - footer.length) + footer;
}

/** Preserve every character, including whitespace and surrogate pairs. */
export function approvalTextParts(text: string): string[] {
  const parts: string[] = [];
  let part = "";
  for (const char of text) {
    if (part.length + char.length > 1700) { parts.push(part); part = ""; }
    part += char;
  }
  if (part || !parts.length) parts.push(part);
  return parts;
}
