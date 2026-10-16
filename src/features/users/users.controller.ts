import type { AllayDeps } from "../../agent/allay";
import { jsonError } from "../../shared/lib/http";
import { logger } from "../../shared/logging/logger";
import { API_ERRORS, apierror } from "../../shared/types/errors";
import { z } from "zod";
import { MAX_MEMORY_CHARS } from "../../infrastructure/memory/memory";

type Params = { userId?: string; memoryId?: string };
type Routed = Request & { params?: Params };

// Player UUIDs and Telegram ids; nothing that could reach into another Redis key or a query.
const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MEMORY_ID = /^[a-z0-9]{1,16}$/;
// The same bounds the remember tool has.
const MemoryBody = z.object({ text: z.string().trim().min(3).max(MAX_MEMORY_CHARS) });

const userOf = (req: Routed): string | undefined => {
  const id = req.params?.userId;
  return id && USER_ID.test(id) ? id : undefined;
};

const badUser = () => jsonError(apierror(API_ERRORS.BAD_REQUEST, "user_id must be 1–64 letters, digits, - or _"));

const failed = (what: string, error: unknown) => {
  logger.warn(`Couldn't ${what}: ${String(error)}`);
  return jsonError({ code: "STORAGE_ERROR", message: `Couldn't ${what}`, statusCode: 503 });
};

/** DELETE /api/v2/users/{user_id}/session: `/ask new`. Memories stay. */
export const handleSession = (deps: AllayDeps) => async (req: Routed): Promise<Response> => {
  if (req.method !== "DELETE") return jsonError(apierror(API_ERRORS.METHOD_NOT_SUPPORTED));
  const userId = userOf(req);
  if (!userId) return badUser();
  try {
    await deps.history.clear(userId);
    return Response.json({ cleared: true });
  } catch (error) {
    return failed("clear the session", error);
  }
};

/** GET lists, POST adds, DELETE wipes /api/v2/users/{user_id}/memories: `/ask memory`, `/ask memory <text>`, and `/ask forget all`. */
export const handleMemories = (deps: AllayDeps) => async (req: Routed): Promise<Response> => {
  const userId = userOf(req);
  if (!userId) return badUser();
  let text: string | undefined;
  if (req.method === "POST") {
    const body = MemoryBody.safeParse(await req.json().catch(() => undefined));
    if (!body.success) return jsonError(apierror(API_ERRORS.BAD_REQUEST, `text must be 3–${MAX_MEMORY_CHARS} characters`));
    text = body.data.text;
  }
  try {
    if (req.method === "GET") return Response.json({ memories: await deps.memories.list(userId) });
    if (text !== undefined) {
      const saved = await deps.memories.add(userId, text);
      return saved === "full" ? jsonError(apierror(API_ERRORS.MEMORY_FULL)) : Response.json({ memory: saved });
    }
    if (req.method === "DELETE") return Response.json({ deleted: await deps.memories.clear(userId) });
  } catch (error) {
    return failed("reach the memories", error);
  }
  return jsonError(apierror(API_ERRORS.METHOD_NOT_SUPPORTED));
};

/** DELETE /api/v2/users/{user_id}/memories/{id}: `/ask forget <n>`. */
export const handleMemory = (deps: AllayDeps) => async (req: Routed): Promise<Response> => {
  if (req.method !== "DELETE") return jsonError(apierror(API_ERRORS.METHOD_NOT_SUPPORTED));
  const userId = userOf(req);
  if (!userId) return badUser();
  const id = req.params?.memoryId;
  if (!id || !MEMORY_ID.test(id)) return jsonError(apierror(API_ERRORS.MEMORY_NOT_FOUND));
  try {
    if (!(await deps.memories.remove(userId, id))) return jsonError(apierror(API_ERRORS.MEMORY_NOT_FOUND));
    return Response.json({ deleted: 1 });
  } catch (error) {
    return failed("forget the memory", error);
  }
};
