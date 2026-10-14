import { Schema, model } from "mongoose";

/** A lasting fact Allay keeps about one player, such as where their base is. */
export interface MemoryDocument {
  id: string;
  user_id: string;
  text: string;
  created_at: Date;
}

const schema = new Schema<MemoryDocument>({
  id: { type: String, required: true },
  user_id: { type: String, required: true },
  text: { type: String, required: true, maxlength: 200 },
  created_at: { type: Date, default: Date.now },
});

schema.index({ user_id: 1, id: 1 }, { unique: true });
schema.index({ user_id: 1, created_at: 1 });

export const MemoryModel = model<MemoryDocument>("Memory", schema);
