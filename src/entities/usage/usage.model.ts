import { Document, Schema, Types, model } from 'mongoose';
import { Usage } from './usage.types';
import { Platform } from '../user/user.types';

const schema = new Schema({
  user: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  cost: {
    type: Number,
    required: true,
    min: 0,
    get: (v: number) => Math.round(v * 1000000) / 1000000,
    set: (v: number) => Math.round(v * 1000000) / 1000000
  },
  tokens: {
    type: Number,
    required: true,
    min: 0
  },
  platform: {
    type: String,
    enum: Object.values(Platform),
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
});

schema.index({ user: 1, created_at: -1 });
schema.index({ platform: 1, created_at: -1 });

export const UsageModel = model<Usage & Document>('Usage', schema);