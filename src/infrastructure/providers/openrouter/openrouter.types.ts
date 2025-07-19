export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}