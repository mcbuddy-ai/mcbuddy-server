// The image gets its version at build time: the release tag, dev-<sha> on master, dev locally.
const VERSION = process.env.APP_VERSION || "dev";

export const handleHealth = async (_: Request) =>
  Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: VERSION,
  })