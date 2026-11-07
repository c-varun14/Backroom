import disclosureTerms from '../../desk/harness/disclosure-terms.json';
/** Deliberately conservative: false blocks are safer than internal-text leaks. */
export const LEAK_GUARD = [
  ...["lead", "desk", "builder", "reviewer", "agent", ...disclosureTerms, "AI", "Switch", "awaiting-owner", "frozen", "draft code", "owner approval", "untrusted"]
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
export function deskAddress(text:string,name="desk") {
  if(!/^[a-z0-9-]+$/.test(name))throw new Error("Invalid desk name");
  return text.replace(/@desk(?=\s|$)/g,"@"+name);
}
export function canonicalDeskBody(body:string,name="desk") {
  if(!/^[a-z0-9-]+$/.test(name))throw new Error("Invalid desk name");
  return body.startsWith("@"+name+" ")?"@desk "+body.slice(name.length+2):body;
}
const clip = (text: string, max: number) => text.length <= max ? text : text.slice(0, max - 1) + "…";
const oneLine = (text: string) => neutralise(text).replace(/[\r\n\t]+/g, " ");
export const projectName = (id: string) => clip(oneLine(id), 60).replace(/^./, c => c.toUpperCase());
export function lineCard(ticket: number, text: string, icon = "🔵") { return clip(`${icon} Ticket #${ticket} · ${oneLine(text)}`, 900); }
export function blockedCard(ticket: number, reason: string) { return lineCard(ticket, `draft blocked: ${reason}`, "⚠️"); }
export function approvalCard(input: { ticket: number; project: string; clientText: string; reply: string; code: string; replacement?: boolean; simulated?: boolean; workRoom?: boolean; stage?: import("./types").Stage; name?: "Ticket" | "Message" | "Question"; suggestTicket?: boolean }) {
  const name = input.name ?? "Ticket";
  const heading = `${name === "Ticket" ? "🟡" : name === "Question" ? "❓" : "💬"} ${projectName(input.project)} · ${name} #${input.ticket} · client wrote:`;
  const context = input.replacement ? "\nNew client message, replaces the earlier draft." : "";
  const client = clip(oneLine(input.clientText), 140).replace(/"/g, "”");
  const footer = (input.simulated ? "\n\nSIMULATION · cannot be sent" : `\n\n✅ To send it, type: send ${input.code}\n\`${input.code}\``)
    + "\n✏️ To change it, just type what to change."
    + (input.suggestTicket ? "\n📁 To start a project from this, type: ticket" : "");
  const prefix = `${heading}${context}\n${client ? '"'+client+'"' : 'A file arrived.'}\n\nI'd reply:\n`;
  const quote = input.reply.split("\n").map(line => `> ${neutralise(line)}`).join("\n");
  const overflow = "… full outgoing text attached and numbered above";
  const budget = 900 - prefix.length - footer.length;
  return prefix + (quote.length <= budget ? quote : clip(quote, Math.max(0,budget-overflow.length-1))+"\n"+overflow) + footer;
}
export const bareAgreement = (body: string) => /^(?:ok|okay|yes|yep|send|approve|approved|looks good|lgtm)[\s\p{P}]*$/iu.test(body.trim());
/** Call before routing or journal retry classification; shortcuts never cross the identity/room boundary. */
export function ownerCommand(body: string, ownerInStudio: boolean, name = "desk") {
  const canonical = canonicalDeskBody(body, name);
  if (!ownerInStudio || canonical !== body || bareAgreement(body)) return canonical;
  const trimmed = body.trim();
  return /^(?:send|deploy|status|ticket|intro|approve|promote|fix|review|video)(?:\s|$)/.test(trimmed) ? "@desk " + trimmed : body;
}
export function needsApprovalText(input: Parameters<typeof approvalCard>[0]) {
  return approvalCard({...input, code:"0".repeat(64)}).includes("… full outgoing text attached");
}

const stageNames = {brief:"Brief",architecture:"Architecture",build:"Build",client_review:"Client review",video:"Video",learn:"Learn"};
export function stageLabel(stage: import("./types").Stage) {
  return `Stage ${Object.keys(stageNames).indexOf(stage) + 1} of 6: ${stageNames[stage]}`;
}
export function stageCard(ticket: number, project: string, stage: import("./types").Stage, summary: string, command: string, icon = "🟡") {
  if (!/^@desk [^\r\n]+$/.test(command)) throw new Error("Exact desk command required");
  const plain = command.replace(/^@desk /, "");
  const code = plain.split(" ").at(-1)!;
  const footer = `\n\nNext: ${plain}${/^[a-f0-9]{10,64}$/.test(code)?`\n\`${code}\``:""}\n✏️ To change it, just type what to change.`;
  const prefix = `${icon} Ticket #${ticket} · ${projectName(project)} · ${stageLabel(stage)}\n`;
  return prefix + clip(oneLine(summary).replace(/\b[a-f0-9]{40,64}\b/g, "the reviewed version"), 900 - prefix.length - footer.length) + footer;
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
