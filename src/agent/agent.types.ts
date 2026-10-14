import type { ByokProvider } from "../infrastructure/providers/openrouter/openrouter.client";

export type Mode = "ask" | "askx";
export type Platform = "minecraft" | "telegram";
/** Who sees the answer: only the asker, or every player online (`/askall`). */
export type Visibility = "private" | "public";

export interface PlayerInfo {
  name: string;
  uuid?: string;
  op?: boolean;
}

export interface ServerInfo {
  /** A random id the plugin keeps for its server; it names the server's shared thread of public questions. */
  id?: string;
  software?: string;
  version?: string;
  plugin_version?: string;
}

/** Everything a run needs to know about who asks and from where. */
export interface RunContext {
  mode: Mode;
  platform: Platform;
  userId: string;
  message: string;
  locale?: string;
  visibility?: Visibility;
  /** The asker's IANA time zone from the plugin; their real time goes in front of each question. */
  timezone?: string;
  player?: PlayerInfo;
  server?: ServerInfo;
  /** Client tools the plugin offers for this run; empty for v1 requests. */
  tools: string[];
  /** The server's own key and models (BYOK); without it the run uses the backend's. */
  provider?: ByokProvider;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost: number;
}

export interface CommandsResult {
  is_sequence: boolean;
  commands: string[];
}

export interface RunResult {
  answer: string;
  commands?: CommandsResult;
  usage: Usage;
  durationMs: number;
}
