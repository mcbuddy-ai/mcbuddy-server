import { describe, expect, test } from "bun:test";
import { localStamp } from "../src/agent/time";

describe("local time in front of questions", () => {
  const now = new Date("2026-10-12T20:42:00Z");

  test("shows the player's zone", () => {
    expect(localStamp("Europe/Moscow", now)).toBe("[Mon, 12 Oct 2026, 23:42 Europe/Moscow]");
    expect(localStamp("Asia/Yekaterinburg", now)).toBe("[Tue, 13 Oct 2026, 01:42 Asia/Yekaterinburg]");
  });

  test("falls back to UTC for a missing or unknown zone", () => {
    expect(localStamp(undefined, now)).toBe("[Mon, 12 Oct 2026, 20:42 UTC]");
    expect(localStamp("Mars/Olympus", now)).toBe("[Mon, 12 Oct 2026, 20:42 UTC]");
  });
});
