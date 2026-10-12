import { Agent } from "@mastra/core/agent";
import { APICallError, type ModelMessage } from "ai";
import type { ToolBridge } from "../features/chat/chat.bridge";
import type { Emit } from "../features/chat/chat.events";
import { exactCalculationsTool } from "../features/tools/exact-calculations.tool";
import { gameTools, offeredTools } from "../features/tools/game.tools";
import { memoryTools } from "../features/tools/memory.tools";
import { searchWebTool } from "../features/tools/search-web.tool";
import type { HistoryStore } from "../infrastructure/history/history";
import type { Memory, MemoryStore } from "../infrastructure/memory/memory";
import type { ModelFactory } from "../infrastructure/providers/openrouter/openrouter.client";
import { logger } from "../shared/logging/logger";
import { API_ERRORS, ApiFailure, apierror } from "../shared/types/errors";
import type { CommandsResult, RunContext, RunResult, Usage } from "./agent.types";
import { commandsFromText, commandsSchema, validateCommands } from "./commands";
import { systemPrompt } from "./prompts";
import { localStamp } from "./time";
import { summarizeWith } from "./summary";

export interface BuddyDeps {
  models: ModelFactory;
  history: HistoryStore;
  memories: MemoryStore;
  bridge: ToolBridge;
}

export interface RunOptions {
  runId: string;
  emit: Emit;
  signal?: AbortSignal;
}

const MAX_STEPS = Number(process.env.MAX_AGENT_STEPS || 8);

/** v1 callers without a user id share "anonymous"; they get no memory. */
const remembers = (userId: string) => userId !== "anonymous";

const loadMemories = async (deps: BuddyDeps, userId: string): Promise<Memory[]> => {
  if (!remembers(userId)) return [];
  try {
    return await deps.memories.list(userId);
  } catch (error) {
    // Memories are a nicety, like history: answer without them.
    logger.warn(`Memories unavailable for ${userId}: ${String(error)}`);
    return [];
  }
};

/** The parts of Mastra's stream output this runner reads, the same for both modes. */
interface AgentStream {
  fullStream: AsyncIterable<{ type: string; payload?: Record<string, unknown> }>;
  usage: Promise<{ inputTokens?: number; outputTokens?: number; reasoningTokens?: number } | undefined>;
  object: Promise<unknown>;
}

const costOf = (metadata: unknown): number => {
  const cost = (metadata as { openrouter?: { usage?: { cost?: unknown } } } | undefined)?.openrouter?.usage?.cost;
  return typeof cost === "number" ? cost : 0;
};

/** Turns whatever went wrong into an error code the plugin and the bot already understand. */
export const classify = (error: unknown, signal?: AbortSignal): ApiFailure => {
  if (error instanceof ApiFailure) return error;
  if (signal?.aborted) return new ApiFailure(apierror(API_ERRORS.CANCELLED));
  if (APICallError.isInstance(error)) {
    return new ApiFailure(apierror(API_ERRORS.AI_REQUEST_FAILED, `${error.statusCode ?? ""} ${error.message}`.trim()));
  }
  const text = error instanceof Error ? error.message : String(error);
  if (/fetch|network|ECONN|ETIMEDOUT|socket/i.test(text)) return new ApiFailure(apierror(API_ERRORS.NETWORK_ERROR, text));
  return new ApiFailure(apierror(API_ERRORS.AI_REQUEST_FAILED, text));
};

/** The question as the model reads it: Minecraft questions start with the player's real date and time. */
const question = (context: RunContext): string =>
  context.platform === "minecraft" && context.mode === "ask" ? `${localStamp(context.timezone)} ${context.message}` : context.message;

/** Adds this exchange to the session; askx requests go in with a slash so later answers know what was run. */
const record = (context: RunContext, deps: BuddyDeps, answer: string, asked: string) =>
  deps.history.append(
    context.userId,
    { role: "user", content: context.mode === "askx" ? `/askx ${context.message}` : asked },
    { role: "assistant", content: answer },
  );

const compact = async (context: RunContext, deps: BuddyDeps) => {
  try {
    const model = deps.models({ token: context.token, platform: context.platform });
    if (await deps.history.compact(context.userId, summarizeWith(model))) logger.info(`Folded the session of ${context.userId}`);
  } catch (error) {
    logger.warn(`Couldn't fold the session of ${context.userId}: ${String(error)}`);
  }
};

/**
 * One question to MCBuddy: builds the agent for this player, streams its work as protocol
 * events, and returns the final answer (or commands for askx).
 */
export const runBuddy = async (context: RunContext, deps: BuddyDeps, options: RunOptions): Promise<RunResult> => {
  const started = Date.now();
  const { runId, emit, signal } = options;
  try {
    const model = deps.models({ token: context.token, platform: context.platform });
    const tools = offeredTools(context.tools, context.player?.op === true);
    const memories = await loadMemories(deps, context.userId);
    // askx turns one request into commands; earlier chat would only confuse it, as in v1.
    const session = context.mode === "ask" ? await deps.history.load(context.userId) : { messages: [] };
    const instructions = systemPrompt({ ...context, tools }, { memories, summary: session.summary });
    const agent = new Agent({ id: "mcbuddy", name: "MCBuddy", instructions, model });
    const asked = question(context);
    const messages: ModelMessage[] = [...session.messages, { role: "user", content: asked }];

    emit({ event: "start", data: { run_id: runId, model: model.modelId } });

    const common = {
      runId,
      abortSignal: signal,
      maxSteps: MAX_STEPS,
      modelSettings: { maxRetries: 2 },
      toolsets: {
        game: gameTools(tools, runId, deps.bridge),
        web: { search_web: searchWebTool(deps.models, { token: context.token, platform: context.platform, emit }) },
        math: { exact_calculations: exactCalculationsTool({ emit }) },
        ...(context.mode === "ask" && remembers(context.userId)
          ? { memory: memoryTools(deps.memories, { userId: context.userId, emit }) }
          : {}),
      },
    };
    const stream = (
      context.mode === "askx"
        ? await agent.stream(messages, { ...common, structuredOutput: { schema: commandsSchema } })
        : await agent.stream(messages, common)
    ) as unknown as AgentStream;

    let text = "";
    let cost = 0;
    // Per-step usage, summed, so the plugin's counter moves while the agent works.
    const sofar: Usage = { input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, cost: 0 };
    for await (const chunk of stream.fullStream) {
      const payload = chunk.payload ?? {};
      switch (chunk.type) {
        case "reasoning-delta":
          if (typeof payload.text === "string" && payload.text) emit({ event: "reasoning", data: { delta: payload.text } });
          break;
        case "text-delta":
          if (typeof payload.text === "string") {
            text += payload.text;
            // askx text is the JSON result, not something to show.
            if (context.mode === "ask") emit({ event: "text", data: { delta: payload.text } });
          }
          break;
        case "step-finish": {
          cost += costOf((payload.metadata as { providerMetadata?: unknown } | undefined)?.providerMetadata);
          const step = (payload.output as { usage?: { inputTokens?: number; outputTokens?: number; reasoningTokens?: number } } | undefined)?.usage;
          sofar.input_tokens += step?.inputTokens ?? 0;
          sofar.output_tokens += step?.outputTokens ?? 0;
          sofar.reasoning_tokens += step?.reasoningTokens ?? 0;
          sofar.cost = Math.round(cost * 1_000_000) / 1_000_000;
          emit({ event: "usage", data: { ...sofar } });
          break;
        }
        case "error":
          throw payload.error ?? new Error("The model stream failed");
      }
    }
    if (signal?.aborted) throw new ApiFailure(apierror(API_ERRORS.CANCELLED));

    const totals = await stream.usage;
    const usage: Usage = {
      input_tokens: totals?.inputTokens ?? 0,
      output_tokens: totals?.outputTokens ?? 0,
      reasoning_tokens: totals?.reasoningTokens ?? 0,
      cost: Math.round(cost * 1_000_000) / 1_000_000,
    };

    let result: RunResult;
    if (context.mode === "askx") {
      const object = (await stream.object.catch(() => undefined)) ?? commandsFromText(text);
      let commands: CommandsResult;
      try {
        commands = validateCommands(object);
      } catch (error) {
        if (error instanceof ApiFailure && error.code === API_ERRORS.AI_ERROR.code) {
          await record(context, deps, `Refused: ${error.message.replace(/^AI returned an error: /, "")}`, asked);
        }
        throw error;
      }
      await record(context, deps, `Commands: ${commands.commands.join("; ")}`, asked);
      emit({ event: "commands", data: commands });
      result = { answer: "", commands, usage, durationMs: Date.now() - started };
    } else {
      const answer = text.trim();
      if (!answer) throw new ApiFailure(apierror(API_ERRORS.NO_AI_RESPONSE));
      await record(context, deps, answer, asked);
      result = { answer, usage, durationMs: Date.now() - started };
    }
    emit({ event: "usage", data: usage });
    emit({ event: "done", data: { answer: result.answer, duration_ms: result.durationMs } });
    logger.info(`Run ${runId} (${context.mode}/${context.platform}) done in ${result.durationMs} ms, ${usage.output_tokens} tokens`);
    // After done: the player has the answer, and the summary can take its time.
    void compact(context, deps);
    return result;
  } catch (error) {
    const failure = classify(error, signal);
    logger.warn(`Run ${runId} failed: ${failure.code} ${failure.message}`);
    emit({ event: "error", data: { code: failure.code, message: failure.message } });
    throw failure;
  }
};
