import { Document, Schema, model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { MinecraftUserData, Platform, TelegramUserData, User } from './user.types';

const schema = new Schema({
  id: {
    type: String,
    default: uuidv4,
    unique: true,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  platform: {
    type: String,
    enum: Object.values(Platform),
    required: true
  },
  platform_data: {
    type: Schema.Types.Mixed,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

schema.index({ platform: 1, 'platform_data.user_id': 1 }, { unique: true });
schema.index({ id: 1 });

schema.pre('save', function (next) {
  if (this.platform === Platform.TELEGRAM) {
    const data = this.platform_data as TelegramUserData;
    if (!data.user_id || !data.user_nickname || !data.user_fullname) {
      return next(new Error('Missing required Telegram user data'));
    }
    if (typeof data.user_id !== 'number') {
      return next(new Error('Telegram user_id must be a number'));
    }
    if (!data.user_nickname || typeof data.user_nickname !== 'string') {
      return next(new Error('Telegram user_nickname is required and must be a string'));
    }
    if (!data.user_fullname || typeof data.user_fullname !== 'string') {
      return next(new Error('Telegram user_fullname is required and must be a string'));
    }
  }

  if (this.platform === Platform.MINECRAFT) {
    const data = this.platform_data as MinecraftUserData;
    if (!data.user_id || !data.user_name || !data.origin) {
      return next(new Error('Missing required Minecraft user data'));
    }
    if (!data.user_id || typeof data.user_id !== 'string') {
      return next(new Error('Minecraft user_id is required and must be a UUID string'));
    }
    if (!data.user_name || typeof data.user_name !== 'string') {
      return next(new Error('Minecraft user_name is required and must be a string'));
    }
    if (!data.origin || typeof data.origin !== 'string') {
      return next(new Error('Minecraft origin is required and must be a string'));
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(data.user_id)) {
      return next(new Error('Minecraft user_id must be a valid UUID'));
    }
  }

  next();
});

export const UserModel = model<User & Document>('User', schema);