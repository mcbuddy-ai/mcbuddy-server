export interface AskXRequest {
  action: string;
  platform?: "minecraft" | "telegram";
  user_id?: string;
}

export interface AskXResponse {
  isSequence: boolean;
  commands: string[];
  error?: string;
}