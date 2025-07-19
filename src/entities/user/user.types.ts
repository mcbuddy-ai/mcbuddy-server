export enum Platform {
  MINECRAFT = 'minecraft',
  TELEGRAM = 'telegram'
}

export interface BaseUser {
  _id?: string;
  id: string; // UUID
  is_active: boolean;
  platform: Platform;
  platform_data: TelegramUserData | MinecraftUserData;
  created_at: Date;
}

export interface TelegramUserData {
  user_id: number; // bigint
  user_nickname: string;
  user_fullname: string;
}

export interface MinecraftUserData {
  user_id: string; // UUID
  user_name: string;
  origin: string; // IP сервера
}

export interface TelegramUser extends BaseUser {
  platform: Platform.TELEGRAM;
  platform_data: TelegramUserData;
}

export interface MinecraftUser extends BaseUser {
  platform: Platform.MINECRAFT;
  platform_data: MinecraftUserData;
}

export type User = TelegramUser | MinecraftUser;