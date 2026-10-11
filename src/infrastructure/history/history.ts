import { redis } from "bun";
import { logger } from "../../shared/logging/logger";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/** Recent messages per user, shared by v1 and v2 so a conversation carries over between them. */
export interface HistoryStore {
  load(userId: string): Promise<HistoryMessage[]>;
  append(userId: string, message: HistoryMessage): Promise<void>;
}

export const MAX_MESSAGES = Number(process.env.MAX_MESSAGES || 25);
export const CHAT_TTL_SECONDS = Number(process.env.CHAT_TTL_SECONDS || 3600);
const MAX_CONTENT = 4000;

const key = (userId: string) => `chat_history:${userId}`;

const parse = (raw: string): HistoryMessage | undefined => {
  try {
    const value = JSON.parse(raw);
    if ((value.role === "user" || value.role === "assistant") && typeof value.content === "string") {
      return { role: value.role, content: value.content };
    }
  } catch {
    // A broken entry is skipped; the rest of the history still helps.
  }
  return undefined;
};

/** Same keys and limits as v1: newest first in a Redis list, trimmed and expiring. */
export const redisHistory: HistoryStore = {
  async load(userId) {
    try {
      const raw = (await redis.send("LRANGE", [key(userId), "0", String(MAX_MESSAGES - 1)])) as string[];
      return (raw ?? []).map(parse).filter((m): m is HistoryMessage => !!m).reverse();
    } catch (error) {
      // History is a nicety: answer without it rather than fail the question.
      logger.warn(`History unavailable for ${userId}: ${String(error)}`);
      return [];
    }
  },
  async append(userId, message) {
    const content = message.content.trim().slice(0, MAX_CONTENT);
    if (!content) return;
    const entry = JSON.stringify({ id: crypto.randomUUID(), role: message.role, content });
    try {
      await redis.send("LPUSH", [key(userId), entry]);
      await redis.send("LTRIM", [key(userId), "0", String(MAX_MESSAGES - 1)]);
      await redis.send("EXPIRE", [key(userId), String(CHAT_TTL_SECONDS)]);
    } catch (error) {
      logger.warn(`Couldn't save history for ${userId}: ${String(error)}`);
    }
  },
};

/** For tests and local runs without Redis. */
export const memoryHistory = (): HistoryStore => {
  const store = new Map<string, HistoryMessage[]>();
  return {
    async load(userId) {
      return [...(store.get(userId) ?? [])];
    },
    async append(userId, message) {
      const list = [...(store.get(userId) ?? []), message].slice(-MAX_MESSAGES);
      store.set(userId, list);
    },
  };
};
