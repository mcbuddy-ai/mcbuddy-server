import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { openrouterEnv } from "./openrouter.env";

export type ModelFactory = (options: { token?: string; platform: string; search?: boolean }) => LanguageModelV4;

/** OpenRouter models: the player's own key when they sent one, the server's otherwise. */
export const openrouterModels: ModelFactory = ({ token, platform, search }) => {
  const env = openrouterEnv();
  const apiKey = token || env.apiKey;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const provider = createOpenRouter({
    apiKey,
    baseURL: env.baseURL,
    headers: { "HTTP-Referer": env.apiUrl, "X-Title": `${env.apiName}/${platform}` },
  });
  if (search) {
    return provider.chat(env.searchModel, {
      usage: { include: true },
      extraBody: { web_search_options: { search_context_size: env.searchContext } },
    });
  }
  return provider.chat(env.model, {
    usage: { include: true },
    ...(env.reasoningEffort ? { reasoning: { effort: env.reasoningEffort } } : {}),
  });
};
