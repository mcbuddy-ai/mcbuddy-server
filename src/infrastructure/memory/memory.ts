import { MemoryModel } from "../../entities/memory/memory.model";

export interface Memory {
  id: string;
  text: string;
  created_at: string;
}

/** Lasting facts per user. Unlike the chat session, they never expire; the player clears them. */
export interface MemoryStore {
  /** Oldest first. */
  list(userId: string): Promise<Memory[]>;
  /** The saved memory, or "full" when the user already has MAX_MEMORIES. */
  add(userId: string, text: string): Promise<Memory | "full">;
  remove(userId: string, id: string): Promise<boolean>;
  clear(userId: string): Promise<number>;
}

export const MAX_MEMORIES = 30;
export const MAX_MEMORY_CHARS = 200;

// Five characters are short enough to read in chat and plenty for 30 facts.
const shortId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 5);

const clean = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, MAX_MEMORY_CHARS);

export const mongoMemories: MemoryStore = {
  async list(userId) {
    const docs = await MemoryModel.find({ user_id: userId }).sort({ created_at: 1 }).limit(MAX_MEMORIES).lean();
    return docs.map((doc) => ({ id: doc.id, text: doc.text, created_at: doc.created_at.toISOString() }));
  },
  async add(userId, text) {
    if ((await MemoryModel.countDocuments({ user_id: userId })) >= MAX_MEMORIES) return "full";
    const doc = await MemoryModel.create({ id: shortId(), user_id: userId, text: clean(text) });
    return { id: doc.id, text: doc.text, created_at: doc.created_at.toISOString() };
  },
  async remove(userId, id) {
    return (await MemoryModel.deleteOne({ user_id: userId, id })).deletedCount > 0;
  },
  async clear(userId) {
    return (await MemoryModel.deleteMany({ user_id: userId })).deletedCount;
  },
};

/** For tests and local runs without MongoDB. */
export const memoryMemories = (): MemoryStore => {
  const store = new Map<string, Memory[]>();
  const of = (userId: string) => store.get(userId) ?? [];
  return {
    async list(userId) {
      return [...of(userId)];
    },
    async add(userId, text) {
      if (of(userId).length >= MAX_MEMORIES) return "full";
      const memory = { id: shortId(), text: clean(text), created_at: new Date().toISOString() };
      store.set(userId, [...of(userId), memory]);
      return memory;
    },
    async remove(userId, id) {
      const before = of(userId);
      store.set(userId, before.filter((m) => m.id !== id));
      return before.length !== of(userId).length;
    },
    async clear(userId) {
      const count = of(userId).length;
      store.delete(userId);
      return count;
    },
  };
};
