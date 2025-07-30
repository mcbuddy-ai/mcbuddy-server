import { redis, serve } from "bun";
import { handleAsk } from "../features/ask/ask.controller";
import { handleAskX } from "../features/askx/askx.controller";
import { handleHealth } from "../features/health/health.controller";
import { logger } from "../shared/logging/logger";
import { connect as mongoConnect, disconnect as mongoDisconnect } from "../infrastructure/database/mongodb.client";
import { shutdownWorker } from "../infrastructure/queues";
import "../infrastructure/queues/workers";

logger.info("MCBuddy Server is starting...");

await redis.ping();
await mongoConnect();

logger.info("Starting AI worker...");

const server = serve({
  port: Number(process.env.PORT) || 3000,
  hostname: "0.0.0.0",
  routes: {
    "/api/health": handleHealth,
    "/api/ask"   : handleAsk,
    "/api/askx"  : handleAskX,
  },
  error: (error: Error) => {
    logger.error("Server error:", error);
    return Response.json({error: "Internal server error"}, { status: 500 });
  }
});

process.on('SIGINT', async () => {
  logger.info('Graceful shutdown: Received SIGINT, closing connections...');
  logger.info('MCBuddy Server is shutting down...');
  server.stop();
  await shutdownWorker();
  redis.close();
  await mongoDisconnect();
  logger.info('All connections closed');
  process.exitCode = 0;
});

process.on('SIGTERM', async () => {
  logger.info('Graceful shutdown: Received SIGTERM, closing connections...');
  logger.info('MCBuddy Server is shutting down...');
  server.stop();
  await shutdownWorker();
  redis.close();
  await mongoDisconnect();
  logger.info('All connections closed');
  process.exitCode = 0;
});