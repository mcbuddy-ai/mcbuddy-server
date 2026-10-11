export const DEFAULT_MODEL = "openai/gpt-6-luna";
export const DEFAULT_SEARCH_MODEL = "perplexity/sonar";

// Perplexity models search but can't call tools. v1 deployments set one as the main model;
// move it to search instead of breaking every run that needs a tool.
const searchOnly = (model: string | undefined) => !!model && model.startsWith("perplexity/");

// Read lazily: tests and tools import these modules without a real key.
export const openrouterEnv = () => ({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1",
  model: searchOnly(process.env.OPENROUTER_API_MODEL) ? DEFAULT_MODEL : process.env.OPENROUTER_API_MODEL || DEFAULT_MODEL,
  searchModel:
    process.env.SEARCH_MODEL ||
    (searchOnly(process.env.OPENROUTER_API_MODEL) ? process.env.OPENROUTER_API_MODEL! : DEFAULT_SEARCH_MODEL),
  searchContext: process.env.OPENROUTER_API_CTX || "medium",
  reasoningEffort: process.env.OPENROUTER_REASONING_EFFORT as "low" | "medium" | "high" | undefined,
  apiUrl: process.env.API_URL || "https://mcbuddy.ru",
  apiName: process.env.API_NAME || "mcbuddy",
});
