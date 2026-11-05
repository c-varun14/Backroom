import { posix } from "node:path";
export type RuntimeContract = {
  version: 1;
  storage: { name: string; target: string; uid: number; gid: number }[];
  settings: Record<string, string>;
  secrets: { name: string; target: string }[];
};
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const name = /^[a-z][a-z0-9_-]{0,30}$/;
function keys(v: Record<string, any>, allowed: string[]) {
  if (Object.keys(v).some(k => !allowed.includes(k))) throw new Error("Unsupported runtime contract field");
}
function target(v: unknown, root: string) {
  if (typeof v !== "string" || !(v === root || v.startsWith(root + "/")) || posix.normalize(v) !== v || /[^a-zA-Z0-9_./-]/.test(v)) throw new Error("Invalid runtime mount target");
  return v;
}
export function parseRuntimeContract(input: unknown): RuntimeContract {
  if (!object(input) || input.version !== 1) throw new Error("Runtime contract version 1 required");
  keys(input, ["version", "storage", "settings", "secrets"]);
  if (input.storage !== undefined && !Array.isArray(input.storage) || input.secrets !== undefined && !Array.isArray(input.secrets) || input.settings !== undefined && !object(input.settings)) throw new Error("Invalid runtime contract shape");
  const storage = (input.storage ?? []).map((s: any) => {
    if (!object(s)) throw new Error("Invalid storage declaration");
    keys(s, ["name", "target", "uid", "gid"]);
    if (!name.test(s.name) || typeof s.name !== "string") throw new Error("Invalid storage name");
    const uid = s.uid ?? 1000, gid = s.gid ?? 1000;
    if (![uid, gid].every(n => Number.isInteger(n) && n >= 1 && n <= 65535)) throw new Error("Invalid storage ownership");
    return { name: s.name, target: target(s.target, "/data"), uid, gid };
  });
  const secrets = (input.secrets ?? []).map((s: any) => {
    if (!object(s)) throw new Error("Invalid secret declaration");
    keys(s, ["name", "target"]);
    if (typeof s.name !== "string" || !name.test(s.name) || typeof s.target !== "string" || !/^\/run\/secrets\/[a-zA-Z0-9_-]+$/.test(s.target)) throw new Error("Invalid secret declaration");
    return {name:s.name,target:s.target};
  });
  for (const entries of [storage, secrets]) if (new Set(entries.map((e: any) => e.name)).size !== entries.length) throw new Error("Duplicate runtime name");
  const mounts = [...storage, ...secrets].map(s => s.target);
  if (mounts.some((a,i) => mounts.some((b,j) => i !== j && (a === b || a.startsWith(b + "/"))))) throw new Error("Overlapping runtime mounts");
  const settings: Record<string,string> = {};
  for (const [key, value] of Object.entries(input.settings ?? {})) {
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(key) || typeof value !== "string" || value.length > 4096 || /[\x00-\x1f]/.test(value)) throw new Error("Invalid runtime setting");
    if ((/(?:PASSWORD|PASSWD|SECRET|TOKEN|CREDENTIAL|API_?KEY|AUTHORIZATION|COOKIE)/.test(key) && !key.endsWith("_FILE")) || /(?:\bsk-[\w-]{12,}|\bgh[pousr]_[\w]{16,}|\beyJ[\w-]+\.[\w-]+\.[\w-]+|Bearer\s+|https?:\/\/[^\s/]+:[^\s/]+@)/i.test(value)) throw new Error("Secret-shaped runtime setting; use a mounted secret file");
    settings[key] = value;
  }
  if (storage.length > 8 || secrets.length > 8 || Object.keys(settings).length > 32) throw new Error("Runtime contract too large");
  return {version:1,storage,settings,secrets};
}
export const emptyRuntime = ():RuntimeContract => ({version:1,storage:[],settings:{},secrets:[]});
/** Compose expands dollars even in JSON strings: retain literal app values. */
export function composeLiteral(value: any): any {
  if (typeof value === "string") return value.replaceAll("$", () => "$$");
  if (Array.isArray(value)) return value.map(composeLiteral);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,composeLiteral(v)]));
  return value;
}
