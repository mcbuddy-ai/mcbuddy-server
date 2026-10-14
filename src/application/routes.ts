import type { AllayDeps } from "../agent/allay";
import type { handleAsk } from "../features/ask/ask.controller";
import type { handleAskX } from "../features/askx/askx.controller";
import type { handleChat, handleToolResult } from "../features/chat/chat.controller";
import type { handleLicense } from "../features/billing/license.controller";
import type { handleHealth } from "../features/health/health.controller";
import type { handleTelegram } from "../features/telegram/telegram.controller";
import type { handleMemories, handleMemory, handleSession } from "../features/users/users.controller";

interface Handlers {
  handleAsk: typeof handleAsk;
  handleAskX: typeof handleAskX;
  handleChat: typeof handleChat;
  handleToolResult: typeof handleToolResult;
  handleHealth: typeof handleHealth;
  handleSession: typeof handleSession;
  handleMemories: typeof handleMemories;
  handleMemory: typeof handleMemory;
  handleLicense: typeof handleLicense;
  handleTelegram: typeof handleTelegram;
}

/** The HTTP routes, built from injected services so tests can serve them with fakes. */
export const routes = (deps: AllayDeps, h: Handlers) => ({
  "/api/health": h.handleHealth(deps),
  "/api/ask": h.handleAsk(deps),
  "/api/askx": h.handleAskX(deps),
  "/api/v2/chat": h.handleChat(deps),
  "/api/v2/chat/:runId/tools/:callId": h.handleToolResult(deps),
  "/api/v2/users/:userId/session": h.handleSession(deps),
  "/api/v2/users/:userId/memories": h.handleMemories(deps),
  "/api/v2/users/:userId/memories/:memoryId": h.handleMemory(deps),
  "/api/v2/license": h.handleLicense(deps),
  "/api/telegram/webhook": h.handleTelegram(deps),
});
