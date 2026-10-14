import type { AllayDeps } from "../../agent/allay";

// The image gets its version at build time: the release tag, dev-<sha> on master, dev locally.
const VERSION = process.env.APP_VERSION || "dev";

/** Says whether billing is on, so a plugin knows if it needs /allay link. */
export const handleHealth = (deps: AllayDeps) => async (_: Request) =>
  Response.json({
    name: "Allay",
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: VERSION,
    billing: deps.billing.enabled,
  });