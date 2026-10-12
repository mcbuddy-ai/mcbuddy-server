import { describe, expect, test } from "bun:test";
import { GAME_TOOLS, type GameToolName, OPERATOR_TOOLS, offeredTools } from "../src/features/tools/game.tools";

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

  test("the 2.2 tools are for everyone", () => {
    const added: GameToolName[] = [
      "add_note", "find_notes", "delete_note", "get_container", "scan_nearby_containers", "get_block_info",
      "get_item_durability", "get_xp_info", "get_food_options", "ping_me", "get_map_info", "get_enchant_options",
      "get_mob_info", "get_light_spawn_check", "get_brewing_items", "scan_farm",
    ];
    expect(GAME_TOOLS).toEqual(expect.arrayContaining(added));
    expect(offeredTools(added, false)).toEqual(added);
  });

  test("the 2.3 tools are for everyone", () => {
    const added: GameToolName[] = [
      "locate_biome", "get_death_info", "find_villagers", "get_anvil_plan", "add_buttons", "write_book",
      "set_goal", "get_goals", "cancel_goal", "set_timezone",
    ];
    expect(offeredTools(added, false)).toEqual(added);
  });
});
