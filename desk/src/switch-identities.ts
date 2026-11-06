export interface Identity { sender: string; kind: "human" | "agent"; agent_id: string | null; users: string[]; external_ids?:string[] }
export interface IdentityConfig { ownerId: string; bridgeId: string; deskId: string; leadId: string; probeId: string; agentIds?:string[] }

/** Switch 0.31 WS sender_kind is null for humans AND agents. Resolve its exact
 * transport sender against Switch's own client/claim records, never a name or
 * a guessed Discord localpart. Read only identity columns in our local DB.
 * This local self-host adapter intentionally does not support remote Switch.
 */
export function switchIdentities(config: IdentityConfig): Identity[] {
  const agents=[...new Set([config.deskId,config.leadId,config.probeId,...(config.agentIds??[])])];
  for (const value of [config.ownerId,config.bridgeId,...agents]) if (!/^[a-f0-9-]{36}$/.test(value)) throw new Error("Invalid identity configuration");
  const query = `SELECT COALESCE(json_agg(x),'[]'::json) FROM (
    SELECT c.matrix_user_id AS sender,
      CASE WHEN a.id IS NOT NULL THEN 'agent' ELSE 'human' END AS kind,
      a.id AS agent_id,
      COALESCE(array_agg(DISTINCT COALESCE(to_jsonb(e)->>'external_user_id',to_jsonb(e)->>'external_id')) FILTER (WHERE e.id IS NOT NULL),'{}'::text[]) AS external_ids,
      COALESCE(array_agg(DISTINCT claim.user_id) FILTER (WHERE claim.user_id IS NOT NULL),'{}'::text[])
      || CASE WHEN c.user_id IS NOT NULL THEN ARRAY[c.user_id] ELSE '{}'::text[] END AS users
    FROM clients c LEFT JOIN agents a ON a.client_id=c.id
    LEFT JOIN external_users e ON e.client_id=c.id
    LEFT JOIN external_user_claims claim ON claim.external_user_id=e.id
    WHERE e.bridge_id='${config.bridgeId}' OR a.id IN (${agents.map(id=>`'${id}'`).join(',')}) OR c.user_id='${config.ownerId}'
    GROUP BY c.matrix_user_id,a.id,c.user_id) x;`;
  const process = Bun.spawnSync(["docker", "exec", "backroom-block0-postgres-1", "psql", "-U", "backroom_owner", "-d", "backroom_switch", "-At", "-c", query], { stdout: "pipe", stderr: "pipe" });
  if (process.exitCode) throw new Error("Switch identity lookup unavailable");
  const result = JSON.parse(new TextDecoder().decode(process.stdout));
  if (!Array.isArray(result)) throw new Error("Invalid Switch identity response");
  return result;
}

export function verifiedSender(sender: string, identities: Identity[], platformKind?: string | null): Identity | undefined {
  if (platformKind === "platform") return undefined;
  return identities.find(identity => identity.sender === sender);
}
