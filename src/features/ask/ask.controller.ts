import { type BuddyDeps, runBuddy } from "../../agent/buddy";
import { silent } from "../chat/chat.events";
import { readJson } from "../../shared/lib/http";
import { logger } from "../../shared/logging/logger";
import { API_ERRORS, type ApiError, ApiFailure, apierror } from "../../shared/types/errors";

interface AskRequest {
  question?: unknown;
  platform?: unknown;
  user_id?: unknown;
}

const error = (e: ApiError): Response => {
  logger.error(`API Error: ${e.code} - ${e.message}`);
  return Response.json(
    { error: e.message, code: e.code, status: "error", timestamp: new Date().toISOString() },
    { status: e.statusCode || 500 },
  );
};

/** POST /api/ask, v1: the Telegram bot and older plugins. Same agent, no game tools, one JSON answer. */
export const handleAsk = (deps: BuddyDeps) => async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return error(apierror(API_ERRORS.METHOD_NOT_SUPPORTED));
  const json = await readJson(req);
  if (!json.ok) return error(json.error);
  const body = (json.body ?? {}) as AskRequest;
  if (typeof body.question !== "string" || !body.question) {
    return error({ code: "QUESTION_REQUIRED", message: "Parameter 'question' is required and must be a string", statusCode: 400 });
  }
  const question = body.question.trim();
  if (!question) return error(apierror(API_ERRORS.EMPTY_QUESTION));
  if (question.length > 1000) return error(apierror(API_ERRORS.QUESTION_TOO_LONG));

  const platform = typeof body.platform === "string" ? body.platform : "unknown";
  const userId = typeof body.user_id === "string" && body.user_id ? body.user_id : "anonymous";
  try {
    const result = await runBuddy(
      {
        mode: "ask",
        platform: platform === "telegram" ? "telegram" : "minecraft",
        userId,
        message: question,
        tools: [],
        token: req.headers.get("X-OpenRouter-Token") || undefined,
      },
      deps,
      { runId: crypto.randomUUID(), emit: silent, signal: req.signal },
    );
    return Response.json({
      answer: result.answer,
      status: "success",
      timestamp: new Date().toISOString(),
      platform,
      user_id: userId,
    });
  } catch (e) {
    return error(e instanceof ApiFailure ? e.toApiError() : apierror(API_ERRORS.AI_REQUEST_FAILED, String(e)));
  }
};
