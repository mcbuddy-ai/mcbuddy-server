import type { Server } from "bun";
import { type BuddyDeps, runBuddy } from "../../agent/buddy";
import { jsonError, readJson } from "../../shared/lib/http";
import { logger } from "../../shared/logging/logger";
import { API_ERRORS, apierror } from "../../shared/types/errors";
import { parseChatRequest, toolAnswerSchema } from "./chat.types";
import { sseResponse } from "./chat.sse";

const MAX_ACTIVE_RUNS = Number(process.env.MAX_ACTIVE_RUNS || 200);

/** POST /api/v2/chat: one question, streamed back as events while the agent works. */
export const handleChat = (deps: BuddyDeps) => async (req: Request, server?: Server): Promise<Response> => {
  if (req.method !== "POST") return jsonError(apierror(API_ERRORS.METHOD_NOT_SUPPORTED));
  const json = await readJson(req);
  if (!json.ok) return jsonError(json.error);
  const parsed = parseChatRequest(json.body, req.headers.get("X-OpenRouter-Token") || undefined);
  if (!parsed.ok) return jsonError(parsed.error);
  if (deps.bridge.active >= MAX_ACTIVE_RUNS) {
    return jsonError({ code: "QUEUE_ERROR", message: "Too many questions at once; try again in a minute", statusCode: 503 });
  }

  // Runs outlast Bun's idle timeout while the model thinks; pings keep proxies happy instead.
  server?.timeout(req, 0);
  const runId = crypto.randomUUID();
  const context = parsed.context;
  logger.info(`Run ${runId}: ${context.mode} from ${context.player?.name ?? context.userId}, tools: ${context.tools.length}`);

  return sseResponse(async (emit, signal) => {
    deps.bridge.open(runId, emit);
    try {
      await runBuddy(context, deps, { runId, emit, signal });
    } finally {
      deps.bridge.close(runId);
    }
  }, req.signal);
};

type Params = { runId: string; callId: string };

/** POST /api/v2/chat/{run_id}/tools/{call_id}: the plugin's answer to a tool call. */
export const handleToolResult = (deps: BuddyDeps) => async (req: Request & { params?: Params }): Promise<Response> => {
  if (req.method !== "POST") return jsonError(apierror(API_ERRORS.METHOD_NOT_SUPPORTED));
  const { runId, callId } = req.params ?? ({} as Params);
  const json = await readJson(req);
  if (!json.ok) return jsonError(json.error);
  const answer = toolAnswerSchema.safeParse(json.body);
  if (!answer.success) return jsonError(apierror(API_ERRORS.BAD_REQUEST, "send { ok: true, result } or { ok: false, error }"));
  const status = deps.bridge.answer(runId, callId, answer.data);
  if (status === 404) return jsonError(apierror(API_ERRORS.RUN_NOT_FOUND));
  if (status === 409) return jsonError(apierror(API_ERRORS.ALREADY_ANSWERED));
  return Response.json({ accepted: true });
};
