// Read lazily: tests and tools import these modules without a real key.
export const openrouterEnv = () => ({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1",
  model: process.env.OPENROUTER_API_MODEL || "openai/gpt-5-mini",
  searchModel: process.env.SEARCH_MODEL || "perplexity/sonar",
  searchContext: process.env.OPENROUTER_API_CTX || "medium",
  reasoningEffort: process.env.OPENROUTER_REASONING_EFFORT as "low" | "medium" | "high" | undefined,
  apiUrl: process.env.API_URL || "https://mcbuddy.ru",
  apiName: process.env.API_NAME || "mcbuddy",
});
