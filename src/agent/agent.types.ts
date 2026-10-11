export type Mode = "ask" | "askx";
export type Platform = "minecraft" | "telegram";

export interface PlayerInfo {
  name: string;
  uuid?: string;
  op?: boolean;
}

export interface ServerInfo {
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
  player?: PlayerInfo;
  server?: ServerInfo;
  /** Client tools the plugin offers for this run; empty for v1 requests. */
  tools: string[];
  /** A player-supplied OpenRouter key; falls back to the server's key. */
  token?: string;
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
