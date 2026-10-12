import { z } from "zod";
import type { RunContext } from "../../agent/agent.types";
import { API_ERRORS, type ApiError, apierror } from "../../shared/types/errors";

const text = (max: number) => z.string().max(max).optional();

// Extra fields are allowed so newer plugins can send more without breaking older backends.
export const chatRequestSchema = z.object({
  mode: z.enum(["ask", "askx"]).default("ask"),
  message: z.string(),
  platform: z.literal("minecraft").default("minecraft"),
  user_id: z.string().min(1).max(64),
  locale: text(16),
  timezone: text(64),
  player: z.object({ name: z.string().min(1).max(32), uuid: text(36), op: z.boolean().optional() }).optional(),
  server: z.object({ software: text(64), version: text(64), plugin_version: text(64) }).optional(),
  tools: z.array(z.string().max(64)).max(256).default([]),
});

export const toolAnswerSchema = z.union([
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.string().max(2000) }),
]);

const LIMITS = { ask: 1000, askx: 500 } as const;

/** Validates a v2 body into a run context, or explains what's wrong with it in v1 error codes. */
export const parseChatRequest = (
  body: unknown,
  token: string | undefined,
): { ok: true; context: RunContext } | { ok: false; error: ApiError } => {
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: apierror(API_ERRORS.BAD_REQUEST, `${issue.path.join(".") || "body"}: ${issue.message}`) };
  }
  const request = parsed.data;
  const message = request.message.trim();
  if (!message) return { ok: false, error: apierror(request.mode === "ask" ? API_ERRORS.EMPTY_QUESTION : API_ERRORS.EMPTY_ACTION) };
  if (message.length > LIMITS[request.mode]) {
    return { ok: false, error: apierror(request.mode === "ask" ? API_ERRORS.QUESTION_TOO_LONG : API_ERRORS.ACTION_TOO_LONG) };
  }
  return {
    ok: true,
    context: {
      mode: request.mode,
      platform: "minecraft",
      userId: request.user_id,
      message,
      locale: request.locale,
      timezone: request.timezone,
      player: request.player,
      server: request.server,
      tools: [...new Set(request.tools)],
      token,
    },
  };
};
