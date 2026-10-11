import { z } from "zod";
import { API_ERRORS, fail } from "../shared/types/errors";
import type { CommandsResult } from "./agent.types";

export const MAX_COMMANDS = 12;

export const commandsSchema = z.object({
  is_sequence: z.boolean().describe("true when the commands must run in order"),
  commands: z.array(z.string()).describe("Commands without a leading slash; empty when refusing"),
  error: z.string().optional().describe("Why the request can't be done, in the player's language"),
});

// The plugin has its own block list; this is the backend's half of the same guard.
const ADMIN_COMMANDS = new Set([
  "op", "deop", "ban", "ban-ip", "pardon", "pardon-ip", "kick", "whitelist", "stop", "reload", "restart",
  "save-all", "save-off", "save-on", "plugins", "pl", "plugin", "debug", "perf", "jfr", "transfer",
]);

const name = (command: string) => command.split(/\s+/, 1)[0].toLowerCase().replace(/^minecraft:/, "");

/** Checks what the model proposed and turns a refusal into an AI_ERROR the player sees. */
export const validateCommands = (raw: unknown): CommandsResult => {
  const parsed = commandsSchema.safeParse(raw);
  if (!parsed.success) return fail(API_ERRORS.INVALID_FORMAT, "the model returned no command list");
  const { is_sequence, error } = parsed.data;
  const commands = parsed.data.commands.map((c) => c.trim().replace(/^\//, "")).filter(Boolean);
  if (commands.length === 0) return fail(API_ERRORS.AI_ERROR, error?.trim() || "no commands for this request");
  if (commands.length > MAX_COMMANDS) return fail(API_ERRORS.TOO_MANY_COMMANDS);
  if (commands.some((c) => c.includes("\n"))) return fail(API_ERRORS.INVALID_FORMAT, "a command spans several lines");
  const blocked = commands.find((c) => ADMIN_COMMANDS.has(name(c)));
  if (blocked) return fail(API_ERRORS.AI_ERROR, `refused to run /${name(blocked)}`);
  return { is_sequence, commands };
};

/** Some models answer with JSON in text instead of structured output; take it from there. */
export const commandsFromText = (text: string): unknown => {
  const body = text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(body);
    // v1 prompts used camelCase.
    if (value && typeof value === "object" && "isSequence" in value && !("is_sequence" in value)) {
      return { ...value, is_sequence: value.isSequence };
    }
    return value;
  } catch {
    return undefined;
  }
};
