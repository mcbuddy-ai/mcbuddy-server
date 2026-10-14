# Changelog

The “Release” workflow takes the notes for a version from its section here, unless you type them into its `changelog` field.

## 4.0.0

MCBuddy Server is now **Allay Server**, for Allay 4.0. Stored data stays as it was: chat sessions and public threads in Redis, memories in MongoDB.

- 🪽 **The agent is Allay.** The prompts introduce it as Allay, named after the friendly flying mob; it says so once when asked who it is, without playing the mob in its answers. “About MCBuddy” is “About Allay”, with `/allay` instead of `/buddy`.
- 🧰 **`get_allay_guide` and `allay_settings`** replace `get_buddy_guide` and `buddy_settings`. A 3.x plugin still offers the old names: the model sees the new ones, and the call goes to the plugin under the name it offered.
- `/api/health` says `"name": "Allay"`; the logs, the default `API_NAME` (`allay`), and the agent's id follow.

## 3.0.0

For MCBuddy Spigot 3.0. Older plugins keep working: everything new is optional in the request.

- 📣 **Public questions.** `visibility: "public"` marks a question every player online sees (`/askall`, or `?` in chat mode). The prompt keeps the asker's coordinates, notes, and memories out of the answer, and the run goes without a book.
- 🧵 **A shared thread per server.** Public questions go to their own thread, named by the plugin's `server.id`, with the asker's name in front of each question. A friend's follow-up continues the talk. The thread lives 2 hours (`PUBLIC_CHAT_TTL_SECONDS`).
- 📖 **MCBuddy explains itself.** `get_buddy_guide` asks the plugin which commands, chat prefixes, settings, and features this player has; the prompt sends every “what can you do?” and “how do I…” there instead of guessing. `buddy_settings` turns chat mode and its tip on or off when the player asks in words.
- 🧩 **Plugins.** `get_server` describes the plugin list the plugin now sends, and the prompt calls it when a question may touch a plugin.
- The prompts know chat mode: plain text, `!` for commands, `?` for everyone, `~` for the ordinary chat.

## 2.4.1

- `/api/health` reports the release version instead of “1.0.0”; builds from master say `dev-<commit>`.

## 2.4.0

Needs MCBuddy Spigot 2.4: the tool set changed, and older plugins lose the tools whose names changed.

- 👀 **Fewer, broader tools.** `look_at` replaces `get_target`, `get_block_info`, `get_container`, `get_enchant_options`, `get_mob_info`, and `get_villager_trades`; `inspect_item` reads maps instead of `get_map_info`; `reminders` and `goals` each take an `action` instead of three tools apiece; `find_item` searches the inventory, the ender chest, and the containers around, inside shulker boxes and bundles too. A player sees 35 tools instead of 44.
- 🔎 **`inspect_item`**: the agent examines one item in full (attack numbers as the tooltip shows them, potion seconds, trims, books, fireworks, maps, what a shulker box or bundle holds) and treats player-written names, lore, and book titles as data, not instructions.
- 🧭 Descriptions say what the plugin really returns: absolute coordinates, the game's dimension ids, advancement keys for goals, recipes beyond the first five, the whole inventory for durability. `point_to` needs no `y` and takes a dimension.
- 🛡️ `/askx` gets only the tools that read the game: no actions, no operator tools.
- 🌍 Server tools send `summary_key` and `summary_values` with their status, so the plugin shows “5 sources” in the player's language.
- The prompt routes questions to the merged tools; descriptions lost the repeated “game data” suffix, since the prompt already says it.
- README in English with a Russian copy, and the MIT license.
- 📦 Releases are made by hand from the “Release” workflow; it tags the version, publishes `ghcr.io/mcbuddy-ai/mcbuddy-server:<version>`, and writes these notes to the GitHub release.

## 2.3.0

- The player's real time goes in front of each question; the 2.3 tools (buttons, windows, goals, books) are described to the model; places go to the notebook.

## 2.2.1

- Accepts every tool a 2.2 plugin offers, not just 32.

## 2.2.0

- The notebook, container, and game-knowledge tools.

## 2.1.0

- Location, trade, compass, sorting, reminder, and operator-only tools; `exact_calculations`; a 24-hour session with a summary; memories in MongoDB and the endpoints behind `/ask new`, `/ask memory`, `/ask forget`; answers in the language of the question.

## 2.0.0

A rewrite as a Mastra agent on Bun 1.4.3.

- `/api/v2/chat` streams answers over Server-Sent Events and hands game tools to the plugin; web search for fresh facts; the prompts live in the repository.
- `/api/ask` and `/api/askx` keep their v1 shapes and run the same agent.

## 1.3.3

- Requests no longer go through a queue.

## 1.2.0

- A request queue, a system prompt for Telegram, and an automated image build.

## 1.1.0

- A client can pass its own OpenRouter token.

## 1.0.0

- `/api/ask` and `/api/askx` for the plugin and the Telegram bot.
