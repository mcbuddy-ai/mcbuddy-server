import { describe, expect, test } from "bun:test";
import { frame, sseResponse } from "../src/features/chat/chat.sse";
import { readSse } from "./helpers";

describe("SSE", () => {
  test("frames are event + data lines and a blank line", () => {
    expect(frame({ event: "text", data: { delta: "hi\nthere" } })).toBe('event: text\ndata: {"delta":"hi\\nthere"}\n\n');
  });

  test("a run's events arrive in order and the stream closes when it ends", async () => {
    const response = sseResponse(async (emit) => {
      emit({ event: "text", data: { delta: "a" } });
      emit({ event: "done", data: { answer: "a", duration_ms: 1 } });
    });
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect((await readSse(response)).map((e) => e.event)).toEqual(["text", "done"]);
  });

  test("a client that goes away aborts the run", async () => {
    let aborted: AbortSignal | undefined;
    const response = sseResponse(
      (_emit, signal) =>
        new Promise<void>((resolve) => {
          aborted = signal;
          signal.addEventListener("abort", () => resolve());
        }),
    );
    await response.body!.cancel();
    expect(aborted?.aborted).toBe(true);
  });
});
