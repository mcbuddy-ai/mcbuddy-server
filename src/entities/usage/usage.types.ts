import { Types } from 'mongoose';
import { Platform } from '../user/user.types';

export interface Usage {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  cost: number;
  tokens: number;
  platform: Platform;
  created_at?: Date;
} 