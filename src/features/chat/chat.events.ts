import type { Usage } from "../../agent/agent.types";

/** Every event the v2 stream sends; see docs/protocol-v2.md. */
export type ChatEvent =
  | { event: "start"; data: { run_id: string; model: string } }
  | { event: "reasoning"; data: { delta: string } }
  | { event: "tool_call"; data: { call_id: string; name: string; args: unknown } }
  | {
      event: "tool_status";
      data: {
        call_id: string;
        name: string;
        kind: "client" | "server";
        state: "started" | "finished" | "failed";
        args?: unknown;
        summary?: string;
      };
    }
  | { event: "text"; data: { delta: string } }
  | { event: "commands"; data: { is_sequence: boolean; commands: string[] } }
  | { event: "usage"; data: Usage }
  | { event: "done"; data: { answer: string; duration_ms: number } }
  | { event: "error"; data: { code: string; message: string } };

export type Emit = (event: ChatEvent) => void;

/** Discards events, for v1 requests that answer in one piece. */
export const silent: Emit = () => {};
