# MCBuddy streaming protocol v2

The plugin opens one streaming request per question. The backend agent (Mastra) streams back what it is doing, and when it needs to know something about the game it asks the plugin to run a tool and post the result back. Web search runs on the backend.

## Request

`POST /api/v2/chat`

Headers: `Content-Type: application/json`, `Accept: text/event-stream`, optional `X-OpenRouter-Token` (a player-supplied OpenRouter key, as in v1), `X-Plugin-Version`.

```json
{
  "mode": "ask",                      // "ask" answers a question; "askx" turns a request into commands
  "message": "what should I do next?", // ≤ 1000 chars for ask, ≤ 500 for askx
  "platform": "minecraft",
  "user_id": "5627dd98-e6be-3c21-b8a8-e92344183641",
  "locale": "ru_ru",
  "player": { "name": "Steve", "uuid": "5627dd98-…", "op": false },
  "server": { "software": "Paper", "version": "26.3", "plugin_version": "2.0.0" },
  "tools": ["get_player_status", "get_inventory", "get_surroundings", "get_target", "get_world", "get_statistics", "get_advancements", "get_recipes", "locate_structure", "get_server"]
}
```

`tools` lists the client tools this plugin offers (server admins can switch some off). The backend registers only those for this run. The plugin lists operator tools only when the asking player is an operator, and the backend drops them anyway when `player.op` is false.

## Response: Server-Sent Events

`Content-Type: text/event-stream`. Every event is `event: <name>` + `data: <json>`. A `: ping` comment goes out every 15 s.

| Event | Data | Meaning |
|---|---|---|
| `start` | `{ "run_id": "uuid", "model": "…" }` | The run began; `run_id` addresses tool results |
| `reasoning` | `{ "delta": "…" }` | A piece of the model's reasoning, when the model exposes it |
| `tool_call` | `{ "call_id": "…", "name": "get_inventory", "args": { … } }` | The plugin must run this client tool and post the result |
| `tool_status` | `{ "call_id": "…", "name": "search_web", "kind": "client" \| "server", "state": "started" \| "finished" \| "failed", "args": { … }, "summary": "5 sources" }` | Progress of any tool, for display. Client tools get `started` right before `tool_call` |
| `text` | `{ "delta": "…" }` | A piece of the answer |
| `commands` | `{ "is_sequence": true, "commands": ["give @s diamond_sword 1"] }` | askx only: the commands to run (≤ 12, no leading slash) |
| `usage` | `{ "input_tokens": 0, "output_tokens": 0, "reasoning_tokens": 0, "cost": 0.0 }` | Totals for the run so far: sent after every model step and once more, final, right before `done`. Each one replaces the last |
| `done` | `{ "answer": "full text", "duration_ms": 5321 }` | The run finished; for askx `answer` may be a short note |
| `error` | `{ "code": "AI_REQUEST_FAILED", "message": "…" }` | The run failed; the stream ends after it. Codes stay compatible with v1 (`QUESTION_TOO_LONG`, `NETWORK_ERROR`, …) plus `TOOL_TIMEOUT`, `RUN_NOT_FOUND` |

## Tool results

`POST /api/v2/chat/{run_id}/tools/{call_id}` with

```json
{ "ok": true, "result": { … } }
{ "ok": false, "error": "player is offline" }
```

Answers: `200 { "accepted": true }`, `404` unknown or finished run or call, `409` already answered. The backend waits up to 15 s per client call; past that the model gets an error result and the run goes on.

## Client tools (run by the plugin, on the server thread, about the asking player only)

| Name | Args | Returns |
|---|---|---|
| `get_player_status` | – | gamemode, health, max_health, food, saturation, level, exp_progress, location {x,y,z}, dimension, biome, light, facing, flying, effects [{type, level, seconds}], held_item |
| `get_inventory` | `{ "include_enderchest"?: bool }` | main [{slot, id, count, name?, enchantments{}, damage?, max_damage?}], armor {head, chest, legs, feet}, offhand, enderchest? |
| `get_surroundings` | `{ "radius"?: 1–16 }` default 8 | most common blocks with counts, notable blocks (ores, chests, spawners, portals…) with offsets from the player, entities within 32 blocks grouped by type with count, nearest distance, hostile flag; other players only as a count |
| `get_target` | – | the block (6 blocks) or entity (16 blocks) under the crosshair |
| `get_world` | – | day time (ticks and phase), day number, moon phase, weather, difficulty, dimension, a few rules that matter for advice (keep_inventory, mob_griefing, players_sleeping_percentage, do_insomnia…), border size |
| `get_statistics` | – | play time, deaths, mob kills, player kills, distance walked/flown, jumps, time since death, time since rest (phantoms) |
| `get_advancements` | `{ "filter"?: "done" \| "todo" }` | advancement titles and descriptions; recipes excluded |
| `get_recipes` | `{ "item": "beacon" }` | how this server crafts or smelts the item: shaped grid, ingredients, results |
| `locate_structure` | `{ "structure": "village" }` | nearest structure within a capped radius, with distance and direction; off when the admin disables it |
| `get_server` | – | software, version, difficulty, online player count, plugin version |
| `get_locations` | – | the player's respawn point (bed or anchor; null when none), the world spawn, and the last death location, each with x, y, z, dimension, distance, and direction from the player when in the same dimension |
| `get_villager_trades` | – | the villager or wandering trader under the crosshair (8 blocks): profession, level, trades [{buy: [{id, count}], sell: {id, count, enchantments?}, uses, max_uses}] |
| `point_to` | `{ "x": 0, "y": 64, "z": 0, "label"?: "base" }` | Points the player's compass at the spot (same dimension) and draws a short particle trail toward it that only this player sees. Returns distance and direction |
| `sort_inventory` | – | Merges stacks and sorts the main inventory (slots 9–35) by item; the hotbar, armor, and offhand stay put. Returns how many stacks were merged |
| `set_reminder` | `{ "minutes": 1–120, "text": "≤ 100 chars" }` | Reminds the player in chat with a sound after the delay and returns the reminder's `id`; at most 10 pending per player by default (`tools.reminders.max_pending`); lost on a server restart or when the player leaves |
| `get_reminders` | – | the player's pending reminders, soonest first: [{id, text, minutes_left, due_at}] |
| `cancel_reminder` | `{ "id": "k3f9" }` or `{ "all": true }` | Cancels one reminder or all of them; returns `{ cancelled }` |

### Operator tools

Listed only for operators and only when the admin enables them (`tools.operator` in the plugin config). The plugin checks `isOp()` again when it runs one. They act on the asking player only.

| Name | Args | Does |
|---|---|---|
| `give_item` | `{ "item": "diamond_sword", "count"?: 1–576, "enchantments"?: { "sharpness": 5 } }` | Puts the item into the player's inventory, dropping what doesn't fit at their feet |
| `teleport` | `{ "x", "y", "z", "dimension"? }` or `{ "player": "name" }` | Teleports the player |
| `set_gamemode` | `{ "mode": "survival" \| "creative" \| "adventure" \| "spectator" }` | Changes the player's game mode |
| `heal` | – | Full health, food, and saturation; puts out fire |
| `apply_effect` | `{ "effect": "night_vision", "seconds"?: 1–3600, "level"?: 1–10 }` or `{ "clear": true }` | Gives the player an effect, or clears all of them |
| `set_time` | `{ "time": "day" \| "noon" \| "night" \| "midnight" \| 0–23999 }` | Sets the time in the player's world |
| `set_weather` | `{ "weather": "clear" \| "rain" \| "thunder", "seconds"?: 1–86400 }` | Sets the weather in the player's world |

## Server tools (run by the backend)

| Name | Args | Notes |
|---|---|---|
| `search_web` | `{ "query": "…" }` | Searches through an OpenRouter online model; the result keeps source URLs |
| `exact_calculations` | `{ "expressions": ["ceil(1000 / 64)", "(-1024 / 8)", "3 hours to seconds"] }` | Up to 10 expressions, each ≤ 300 chars, evaluated with math.js at 64 significant digits (units and conversions work). Returns `[{ expression, result }]` or `{ expression, error }` per line; each expression gets 1 s |
| `remember` | `{ "text": "≤ 200 chars" }` | Saves a lasting fact about the player (base location, goals, preferences); at most 30 per player |
| `forget` | `{ "id": "…" }` | Deletes one remembered fact |

All server tools report progress only through `tool_status` (kind `server`).

## Conversation memory

The backend keeps two things per `user_id`:

- **The session.** At least the last 8 exchanges verbatim plus a short summary of everything older. Once 12 pile up, the backend folds the oldest into the summary with the model, after the answer is out. A session lives 24 hours after the last question. `/askx` requests land in it as one short exchange (the request and the commands or the refusal), so a later `/ask` knows what was done.
- **Memories.** Lasting facts the model saves with `remember`, kept in MongoDB without expiry. They go into the system prompt with their ids.

Endpoints for the plugin's `/ask new`, `/ask memory`, and `/ask forget`:

| Request | Answer |
|---|---|
| `DELETE /api/v2/users/{user_id}/session` | `200 { "cleared": true }`; memories stay |
| `GET /api/v2/users/{user_id}/memories` | `200 { "memories": [{ "id": "k3f9a", "text": "…", "created_at": "ISO-8601" }] }`, oldest first |
| `DELETE /api/v2/users/{user_id}/memories` | `200 { "deleted": 4 }`: all of them |
| `DELETE /api/v2/users/{user_id}/memories/{id}` | `200 { "deleted": 1 }`, or `404` |

## Compatibility

`POST /api/ask` and `POST /api/askx` keep their v1 request and response shapes. They run the same agent without client tools, so the Telegram bot and older plugins keep working.
