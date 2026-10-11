import type { BuddyDeps } from "../agent/buddy";
import type { handleAsk } from "../features/ask/ask.controller";
import type { handleAskX } from "../features/askx/askx.controller";
import type { handleChat, handleToolResult } from "../features/chat/chat.controller";
import type { handleHealth } from "../features/health/health.controller";

interface Handlers {
  handleAsk: typeof handleAsk;
  handleAskX: typeof handleAskX;
  handleChat: typeof handleChat;
  handleToolResult: typeof handleToolResult;
  handleHealth: typeof handleHealth;
}

/** The HTTP routes, built from injected services so tests can serve them with fakes. */
export const routes = (deps: BuddyDeps, h: Handlers) => ({
  "/api/health": h.handleHealth,
  "/api/ask": h.handleAsk(deps),
  "/api/askx": h.handleAskX(deps),
  "/api/v2/chat": h.handleChat(deps),
  "/api/v2/chat/:runId/tools/:callId": h.handleToolResult(deps),
});
