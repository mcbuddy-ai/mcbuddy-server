import minecraftAsk from "../prompts/minecraft-ask.md" with { type: "text" };
import minecraftAskx from "../prompts/minecraft-askx.md" with { type: "text" };
import telegram from "../prompts/telegram.md" with { type: "text" };
import type { RunContext } from "./agent.types";

const decode = (value: string | undefined): string | undefined =>
  value ? Buffer.from(value, "base64").toString("utf-8") : undefined;

// The base64 variables are the v1 way to set prompts. They still win when set, so an existing
// deployment keeps its prompts until the operator removes them.
const overrides = () => ({
  ask: decode(process.env.SYSTEM_MESSAGE),
  askx: decode(process.env.ASKX_SYSTEM_MESSAGE),
  telegram: decode(process.env.SYSTEM_MESSAGE_TG),
  context: decode(process.env.SYSTEM_MESSAGE_WITH_CONTEXT),
});

const base = (context: RunContext): string => {
  const env = overrides();
  if (context.mode === "askx") return env.askx ?? minecraftAskx;
  if (context.platform === "telegram") return env.telegram ?? telegram;
  return env.ask ?? minecraftAsk;
};

const yesNo = (value: boolean | undefined) => (value ? "yes" : "no");

/** The system prompt for one run: the base prompt plus what we know about this conversation. */
export const systemPrompt = (context: RunContext): string => {
  const lines = [`- Today: ${new Date().toISOString().slice(0, 10)}`, `- Locale: ${context.locale ?? "ru_ru"}`];
  if (context.player) lines.push(`- Player: ${context.player.name} (operator: ${yesNo(context.player.op)})`);
  if (context.server) {
    lines.push(`- Server: ${context.server.software ?? "unknown"} ${context.server.version ?? ""}`.trimEnd());
  } else if (context.platform === "minecraft") {
    lines.push("- Server: version unknown; assume the latest Java Edition release");
  }
  lines.push(
    context.tools.length > 0
      ? `- Game tools you can call: ${context.tools.join(", ")}`
      : "- No game tools in this conversation: answer from knowledge and search_web",
  );
  const extra = overrides().context;
  return [base(context).trim(), "# This conversation", lines.join("\n"), extra].filter(Boolean).join("\n\n");
};
