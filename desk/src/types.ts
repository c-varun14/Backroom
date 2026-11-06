export interface Project {
  clientSurface?: "forum";
  id: string;
  ownerId: string;
  studioRoomId: string;
  clientRoomId: string;
  clientIds: string[];
}

export interface Attachment { name: string; sha256: string }
export interface DraftInput {
  project: string;
  /** Omit for the project's default conversation thread. */
  threadId?: string;
  destinationRoomId: string;
  clientThread?: string;
  text: string;
  attachments: Attachment[];
}
export interface Draft extends DraftInput {
  id: string;
  threadId: string;
  code: string;
  contentHash: string;
}
export interface PreparedContent {
  text: string;
  attachments: { name: string; bytes: Uint8Array }[];
}
export interface Delivery extends PreparedContent {
  deliveryId: string;
  project: string;
  destinationRoomId: string;
  clientThread?: string;
  draftId?: string;
}
export interface Transport {
  /** Resolve the actual bytes to be sent, not caller-supplied hash claims. */
  prepare(draft: Readonly<Draft>): Promise<PreparedContent>;
  /** Never retry internally unless the provider deduplicates deliveryId. */
  send(delivery: Delivery): Promise<void>;
}
export interface Deployer {
  deploy(input: { project: string; commitSha: string; intentId: string }): Promise<void>;
}
export interface Message {
  senderId: string;
  senderKind: "human" | "agent";
  roomId: string;
  body: string;
  eventId: string;
}
export type Result = { status: "sent" | "deployed" | "rejected" | "duplicate" | "uncertain"; reason?: string };
export const STAGES = ["brief", "architecture", "build", "client_review", "video", "learn"] as const;
export type Stage = typeof STAGES[number];
export type Artifact = { kind: "document"; id: string } | { kind: "commit"; sha: string } | { kind: "video"; sha256: string };
export interface StageRecord { version: number; artifact: Artifact | null; approvals: string[] }
export interface Workflow {
  stage: Stage;
  completed: boolean;
  stages: Record<Stage, StageRecord>;
}
