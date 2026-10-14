import { describe, expect, test } from "bun:test";
import { FOLD_AT_EXCHANGES, KEEP_EXCHANGES, type HistoryMessage, memoryHistory, threadOf } from "../src/infrastructure/history/history";

const exchange = (i: number): HistoryMessage[] => [
  { role: "user", content: `question ${i}` },
  { role: "assistant", content: `answer ${i}` },
];

describe("the chat session", () => {
  test("public questions go to the server's thread, everything else to the asker's own", () => {
    expect(threadOf("p1", "public", "srv-1")).toBe("public:srv-1");
    expect(threadOf("p1", "private", "srv-1")).toBe("p1");
    // A plugin without a server id can't name a shared thread.
    expect(threadOf("p1", "public", undefined)).toBe("p1");
  });

  test("isn't folded until enough exchanges pile up", async () => {
    const history = memoryHistory();
    for (let i = 0; i < FOLD_AT_EXCHANGES; i++) await history.append("p1", ...exchange(i));
    expect(await history.compact("p1", async () => "never")).toBe(false);
    expect((await history.load("p1")).messages).toHaveLength(FOLD_AT_EXCHANGES * 2);
  });

  test("folds everything but the last exchanges into the summary", async () => {
    const history = memoryHistory();
    await history.append("p1", ...exchange(0));
    await history.compact("p1", async () => "");
    for (let i = 1; i <= FOLD_AT_EXCHANGES; i++) await history.append("p1", ...exchange(i));
    let seen: { summary?: string; older: HistoryMessage[] } | undefined;
    const folded = await history.compact("p1", async (summary, older) => {
      seen = { summary, older };
      return "The player asked questions 0 to 4.";
    });
    expect(folded).toBe(true);
    // The oldest exchanges went to the summarizer, in order.
    expect(seen!.older[0]).toEqual({ role: "user", content: "question 0" });
    expect(seen!.older).toHaveLength((FOLD_AT_EXCHANGES + 1 - KEEP_EXCHANGES) * 2);
    const session = await history.load("p1");
    expect(session.summary).toBe("The player asked questions 0 to 4.");
    expect(session.messages).toHaveLength(KEEP_EXCHANGES * 2);
    expect(session.messages.at(-1)).toEqual({ role: "assistant", content: `answer ${FOLD_AT_EXCHANGES}` });
  });

  test("a failed summary keeps the session as it was", async () => {
    const history = memoryHistory();
    for (let i = 0; i <= FOLD_AT_EXCHANGES; i++) await history.append("p1", ...exchange(i));
    await expect(history.compact("p1", async () => { throw new Error("model down"); })).rejects.toThrow("model down");
    expect((await history.load("p1")).messages.at(-1)).toEqual({ role: "assistant", content: `answer ${FOLD_AT_EXCHANGES}` });
  });

  test("clear starts over", async () => {
    const history = memoryHistory();
    await history.append("p1", ...exchange(1));
    await history.clear("p1");
    expect(await history.load("p1")).toEqual({ messages: [] });
  });
});
