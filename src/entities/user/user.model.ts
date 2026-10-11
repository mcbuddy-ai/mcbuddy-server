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

// Mongoose 9 hooks report failures by throwing; there is no next() any more.
schema.pre('save', function () {
  if (this.platform === Platform.TELEGRAM) {
    const data = this.platform_data as TelegramUserData;
    if (!data.user_id || !data.user_nickname || !data.user_fullname) {
      throw new Error('Missing required Telegram user data');
    }
    if (typeof data.user_id !== 'number') {
      throw new Error('Telegram user_id must be a number');
    }
    if (!data.user_nickname || typeof data.user_nickname !== 'string') {
      throw new Error('Telegram user_nickname is required and must be a string');
    }
    if (!data.user_fullname || typeof data.user_fullname !== 'string') {
      throw new Error('Telegram user_fullname is required and must be a string');
    }
  }

  if (this.platform === Platform.MINECRAFT) {
    const data = this.platform_data as MinecraftUserData;
    if (!data.user_id || !data.user_name || !data.origin) {
      throw new Error('Missing required Minecraft user data');
    }
    if (!data.user_id || typeof data.user_id !== 'string') {
      throw new Error('Minecraft user_id is required and must be a UUID string');
    }
    if (!data.user_name || typeof data.user_name !== 'string') {
      throw new Error('Minecraft user_name is required and must be a string');
    }
    if (!data.origin || typeof data.origin !== 'string') {
      throw new Error('Minecraft origin is required and must be a string');
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(data.user_id)) {
      throw new Error('Minecraft user_id must be a valid UUID');
    }
  }

});

export const UserModel = model<User & Document>('User', schema);