# Changelog

The “Release” workflow takes the notes for a version from its section here, unless you type them into its `changelog` field.

## 2.4.0

- 🔍 **`inspect_item`** for plugins 2.4: the agent examines one item in full (attack numbers as the tooltip shows them, potion seconds, trims, books, fireworks, what a shulker box or bundle holds) and treats player-written names, lore, and book titles as data, not instructions. `get_container` takes `detail`.
- 🎒 The agent counts what bundles and shulker boxes hold when a player asks how many of something they have.
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
