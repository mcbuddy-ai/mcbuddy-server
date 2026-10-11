import type { BuddyDeps } from "../agent/buddy";
import { bridge } from "../features/chat/chat.bridge";
import { redisHistory } from "../infrastructure/history/history";
import { mongoMemories } from "../infrastructure/memory/memory";
import { openrouterModels } from "../infrastructure/providers/openrouter/openrouter.client";

/** The real services; tests build their own with a mock model and in-memory history. */
export const productionDeps: BuddyDeps = { models: openrouterModels, history: redisHistory, memories: mongoMemories, bridge };
