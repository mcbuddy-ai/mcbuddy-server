import { API_ERRORS, type ApiError, apierror } from "../types/errors";
import { logger } from "../logging/logger";

/** Reads a JSON body or reports INVALID_JSON; an empty body counts as invalid too. */
export const readJson = async (req: Request): Promise<{ ok: true; body: unknown } | { ok: false; error: ApiError }> => {
  try {
    return { ok: true, body: await req.json() };
  } catch (error) {
    logger.warn(`Invalid JSON body: ${String(error)}`);
    return { ok: false, error: apierror(API_ERRORS.INVALID_JSON) };
  }
};

/** v2 error shape; v1 handlers keep their own. */
export const jsonError = (error: ApiError): Response =>
  Response.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode ?? 500 });
