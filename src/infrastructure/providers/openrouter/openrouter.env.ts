import { fail } from "../../../shared/lib/error";

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || fail("OPENROUTER_API_KEY is not set")();
export const OPENROUTER_BASE_URL = process.env.OPENROUTER_API_URL || fail("OPENROUTER_API_URL is not set")();
export const OPENROUTER_API_MODEL = process.env.OPENROUTER_API_MODEL || fail("OPENROUTER_API_MODEL is not set")();
export const OPENROUTER_API_CTX = process.env.OPENROUTER_API_CTX || fail("OPENROUTER_API_CTX is not set")();
export const API_URL = process.env.API_URL || fail("API_URL is not set")();
export const API_NAME = process.env.API_NAME || fail("API_NAME is not set")();