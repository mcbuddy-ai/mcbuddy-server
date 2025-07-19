export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskRequest {
  question: string;
  platform?: "minecraft" | "telegram";
  user_id?: string;
}

export interface AskResponse { 
  response: string;
}

export interface OpenRouterResponse {
  choices: Array<{message: { content: string }}>;
  usage?: {
    total_tokens: number;
    cost: number;
  };
} 