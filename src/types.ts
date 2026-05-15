export type ClaudeSender = "human" | "assistant" | string;

export interface ClaudeContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: {
    title?: string;
    widget_code?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ClaudeMessage {
  uuid?: string;
  sender: ClaudeSender;
  text?: string;
  content?: ClaudeContentBlock[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ClaudeSnapshot {
  uuid?: string;
  conversation_uuid?: string;
  snapshot_name?: string;
  created_at?: string;
  updated_at?: string;
  chat_messages?: ClaudeMessage[];
  [key: string]: unknown;
}

export type ExportFormat = "md" | "html" | "pdf";

export interface RenderInput {
  snapshot: ClaudeSnapshot;
  sourceUrl?: string;
}

export interface CliOptions {
  url?: string;
  snapshotPath?: string;
  sourceUrl?: string;
  out?: string;
  repo?: string;
  repoPath?: string;
  branch?: string;
  stdout: boolean;
  format: ExportFormat;
  profileDir?: string;
  timeoutMs: number;
  saveSnapshotPath?: string;
  force: boolean;
}
