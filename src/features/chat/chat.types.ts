import { z } from "zod";
import type { RunContext } from "../../agent/agent.types";
import type { ProviderBlock } from "../billing/gate";
import { API_ERRORS, type ApiError, apierror } from "../../shared/types/errors";

const text = (max: number) => z.string().max(max).optional();

// Extra fields are allowed so newer plugins can send more without breaking older backends.
export const chatRequestSchema = z.object({
  mode: z.enum(["ask", "askx"]).default("ask"),
  message: z.string(),
  platform: z.literal("minecraft").default("minecraft"),
  visibility: z.enum(["private", "public"]).default("private"),
  // No colon: "public:<server id>" names a server's shared thread, and a player must not write into it as themselves.
  user_id: z.string().min(1).max(64).regex(/^[^:]+$/),
  locale: text(16),
  timezone: text(64),
  player: z.object({ name: z.string().min(1).max(32), uuid: text(36), op: z.boolean().optional() }).optional(),
  server: z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(), software: text(64), version: text(64), plugin_version: text(64) }).optional(),
  tools: z.array(z.string().max(64)).max(256).default([]),
  // Since 5.0: the server's own provider; its key comes in X-Provider-Key.
  provider: z.object({ base_url: text(512), model: text(200), search_model: text(200) }).optional(),
});

export const toolAnswerSchema = z.union([
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.string().max(2000) }),
]);

const LIMITS = { ask: 1000, askx: 500 } as const;

/** Validates a v2 body into a run context, or explains what's wrong with it in v1 error codes. Who pays is decided later. */
export const parseChatRequest = (
  body: unknown,
): { ok: true; context: RunContext; provider?: ProviderBlock } | { ok: false; error: ApiError } => {
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
      visibility: request.mode === "askx" ? "private" : request.visibility,
      timezone: request.timezone,
      player: request.player,
      server: request.server,
      tools: [...new Set(request.tools)],
    },
    provider: request.provider,
  };
};
