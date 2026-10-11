import { describe, expect, test } from "bun:test";
import { GAME_TOOLS, OPERATOR_TOOLS, offeredTools } from "../src/features/tools/game.tools";

describe("offered game tools", () => {
  test("operators get the operator tools the plugin offers", () => {
    expect(offeredTools(["get_world", "give_item", "heal"], true)).toEqual(["get_world", "give_item", "heal"]);
  });

  test("everyone else loses them, even when a plugin offers them", () => {
    expect(offeredTools(["get_world", "give_item", "set_reminder", "teleport"], false)).toEqual(["get_world", "set_reminder"]);
  });

  test("unknown names are dropped", () => {
    expect(offeredTools(["get_world", "rm_rf"], true)).toEqual(["get_world"]);
  });

  test("player and operator tools don't overlap", () => {
    expect(GAME_TOOLS.filter((name) => OPERATOR_TOOLS.includes(name))).toEqual([]);
    expect(GAME_TOOLS).toEqual(expect.arrayContaining(["point_to", "set_reminder", "get_reminders", "cancel_reminder"]));
    expect(OPERATOR_TOOLS).toContain("give_item");
  });
});
