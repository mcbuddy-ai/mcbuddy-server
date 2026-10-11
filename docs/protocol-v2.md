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

`tools` lists the client tools this plugin offers (server admins can switch some off). The backend registers only those for this run.

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
| `usage` | `{ "input_tokens": 0, "output_tokens": 0, "reasoning_tokens": 0, "cost": 0.0 }` | Totals for the run |
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

## Server tools (run by the backend)

| Name | Args | Notes |
|---|---|---|
| `search_web` | `{ "query": "…" }` | Searches through an OpenRouter online model; the result keeps source URLs. Reported only through `tool_status` (kind `server`) |

## Compatibility

`POST /api/ask` and `POST /api/askx` keep their v1 request and response shapes. They run the same agent without client tools, so the Telegram bot and older plugins keep working.
