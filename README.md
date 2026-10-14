# 🛠️ Allay Server

[![AI Capable](https://img.shields.io/badge/AI-Capable-brightgreen?style=flat&logo=openai&logoColor=white)](https://github.com/allay-ai/server)
[![GitHub Release](https://img.shields.io/github/v/release/allay-ai/server?style=flat&logo=github&color=blue)](https://github.com/allay-ai/server/releases)
[![Docker](https://img.shields.io/badge/Docker-Available-2496ED?style=flat&logo=docker&logoColor=white)](https://github.com/allay-ai/server/pkgs/container/server)
[![Bun](https://img.shields.io/badge/Bun-1.2.18-000000?style=flat&logo=bun&logoColor=white)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.0.15-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-8.2-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)

[Русская версия](https://github.com/allay-ai/server/blob/master/README.RU.md)

**Allay Server**—🛠️⚡ the backend for Allay, the AI helper named after the friendly mob that brings players what they need: a fast server on Bun with OpenRouter integration and web search, processing requests from Minecraft and Telegram. Provides REST API for getting AI answers about Minecraft with context and chat history. 🌟

> **Note**: This is the main backend for the Allay ecosystem, providing AI answers for all clients.

## How it works

Allay Server is a [Mastra](https://mastra.ai) agent on top of OpenRouter that answers players in Minecraft and in Telegram. In the game it sees what is going on with the player who asks: inventory, health, surroundings, the recipes of that server. It searches the web on its own when a question needs fresh facts.

The plugin opens one streaming request, `POST /api/v2/chat`, per question. The server answers with Server-Sent Events while the agent works:

- `reasoning` – pieces of the model's reasoning, when the model exposes it;
- `tool_call` – the agent needs something from the game, such as the inventory. The plugin runs the tool and posts the result to `POST /api/v2/chat/{run_id}/tools/{call_id}`;
- `tool_status` – what the agent is doing right now: reading the inventory, searching the web;
- `text` – the answer as it's written, then `usage` and `done`.

For `/askx`, a `commands` event with the command list replaces the text. The full protocol is in [docs/protocol-v2.md](docs/protocol-v2.md).

Game tools only see the player who asked and the world around them; other players' coordinates and inventories stay out of reach. The plugin sends the list of tools it offers, so a server admin can switch any of them off. Besides reading, everyone gets harmless actions: pointing the compass at a spot, sorting the inventory, reminders, and a notebook. The agent pins a note to a place (“a villager here sells arrows”), then finds it from a loose question later and points the way. In one call it sees whatever the player looks at: a block, a chest, a mob, or a villager. It finds where an item is, even inside shulker boxes and bundles, examines any item in full (a book’s enchantments, a potion’s effects, a weapon’s damage and speed, a shulker box’s contents), works out durability, XP, and food, tells where to put torches, and estimates a farm’s rate. Tools that give items, teleport, or change the game mode, time, or weather go to operators only. The backend drops them for everyone else, even if a plugin offers them, and `/askx` gets only the tools that read the game. Server tools send their short results as a key, so the plugin shows them in the player's language.

Three tools run on the backend:

- `search_web` searches the web through a search model. The agent decides when it's worth it instead of searching for every question;
- `exact_calculations` evaluates expressions exactly with [math.js](https://mathjs.org) at 64 significant digits: stacks, Nether coordinates, XP, unit conversions. Each expression runs in a worker for at most a second;
- `remember` and `forget` keep a lasting memory about the player.

The agent answers in the language of the question. The game locale only matters when the message has no clear language.

The backend puts the player’s real date and time in front of each Minecraft question, for example `[Mon, 12 Oct 2026, 23:42 Europe/Moscow]`. The plugin sends the time zone. The time goes into the message, not the system prompt, so the provider’s prompt cache keeps working.

Besides the text, the agent puts buttons under its answer (`add_buttons`): options for an ambiguous question, a next question, the way to coordinates, and the recipe, enchanting, and villager windows. When the player asks for detail, it writes the answer into a book (`write_book`), and it sets goals like “collect 16 diamonds” as a bar at the top of the screen (`goals`).

The agent also knows Allay itself. Asked “what can you do?” or “how do I turn off chat mode?”, it calls `get_allay_guide`: the plugin answers with the commands this player may use, chat mode's prefixes, their settings, and what this server has switched on. So the agent never names a command that isn't there. `allay_settings` turns chat mode and its tip on or off when the player asks in words. `get_server` lists the server's plugins with versions, so a question about graves or land claims gets an answer for the plugin that really runs.

A question from `/askall` comes with `visibility: "public"`: every player online sees it and the answer. The prompt tells the agent not to reveal the asker's coordinates, notes, or memories, and the run goes without a book.

### Memory

Each player has a session and a lasting memory. The session lives in Redis for 24 hours after the last question. It holds the last 8 to 12 questions verbatim and a short summary of everything before them. The model writes that summary after the answer, so the player never waits for it. `/askx` requests land in the session as one line: what was asked and which commands came out.

Public questions have their own thread, one per server, apart from players' sessions. Each question there starts with the asker's name, so when a friend follows up on someone else's question, the agent knows what it's about. The thread lives 2 hours after the last question.

The lasting memory sits in MongoDB and never expires. It's up to 30 short facts: where the base is, what the player is working on, how they like answers. The agent saves them itself and says so. The plugin gives players `/allay new`, `/allay memory`, and `/allay forget` through the `/api/v2/users/{user_id}/…` endpoints described in the protocol.

`POST /api/ask` and `POST /api/askx` work as before for the Telegram bot and plugins older than 2.0: the same agent without game tools, one JSON answer. The session is shared between both API versions.

> Pending tool calls live in the process's memory, so the server assumes a single instance. With several, the tool result must reach the instance that holds the stream.

### Examples

```bash
# v1: one JSON answer
curl -X POST https://mcbuddy.ru/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I craft a diamond pickaxe?", "platform": "telegram", "user_id": "42"}'
# {"answer": "...", "status": "success", "timestamp": "...", "platform": "telegram", "user_id": "42"}

# v2: a stream of events
curl -N -X POST https://mcbuddy.ru/api/v2/chat \
  -H "Content-Type: application/json" -H "Accept: text/event-stream" \
  -d '{"mode": "ask", "message": "what should I do next?", "user_id": "5627dd98-...", "player": {"name": "Steve"}, "tools": ["get_inventory"]}'
```

Players and bots can send `X-OpenRouter-Token: sk-or-...` to use their own OpenRouter key and billing.

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter key | required |
| `OPENROUTER_API_URL` | OpenRouter API address | `https://openrouter.ai/api/v1` |
| `OPENROUTER_API_MODEL` | The agent's model. It must support tool calling: `perplexity/sonar*` won't do | `openai/gpt-6-luna` |
| `SEARCH_MODEL` | Online model for web search | `perplexity/sonar` |
| `OPENROUTER_API_CTX` | Search context size: `low`, `medium`, `high` | `medium` |
| `OPENROUTER_REASONING_EFFORT` | Reasoning effort for models that reason: `low`, `medium`, `high` | unset |
| `TOOL_TIMEOUT_MS` | How long to wait for the plugin's tool result | `15000` |
| `MAX_AGENT_STEPS` | Model calls per question | `8` |
| `MAX_ACTIVE_RUNS` | Streaming questions at once | `200` |
| `SSE_PING_MS` | Ping interval that keeps proxies from closing the stream | `15000` |
| `CHAT_TTL_SECONDS` | How long a chat session lives after the last question | `86400` |
| `PUBLIC_CHAT_TTL_SECONDS` | How long a server's thread of public questions lives after the last one | `7200` |
| `CALC_TIMEOUT_MS` | How long `exact_calculations` gives one expression | `1000` |

Prompts live in [src/prompts](src/prompts) (`minecraft-ask.md`, `minecraft-askx.md`, `telegram.md`) and ship inside the build. Each run appends who asks, their language, the server version, and the available tools. Remove old `SYSTEM_MESSAGE*` variables to switch to the new prompts. The old `SYSTEM_MESSAGE*` variables are no longer read. A `perplexity/…` main model can’t call tools, so the server moves it to search and answers with the default model.

## Deployment

### Docker Compose (recommended for production)

1. **Prepare configuration:**
   ```bash
   # Clone the repository
   git clone https://github.com/allay-ai/server
   cd server
   
   # Copy environment variables example
   cp .env.sample .env
   
   # Edit the .env file with your settings
   nano .env
   ```

2. **Domain setup:**
   ```bash
   # Edit Caddyfile and replace mcbuddy.ru with your domain
   nano configurations/caddy/Caddyfile
   ```

3. **Start:**
   ```bash
   docker compose up -d
   ```

4. **Check status:**
   ```bash
   docker compose logs -f allay-server
   ```

### Docker Compose with pre-built image

If you want to use the pre-built image and manage MongoDB/Redis yourself:

1. Declare the allay-server service in `docker-compose.yml`:

```yaml
services:
  allay-server:
    image: ghcr.io/allay-ai/server:4.0.0
    env_file: .env
    environment:
      MONGODB_URI: ${MONGODB_URI}
      REDIS_URL: ${REDIS_URL}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      # ... other environment variables
```

> **Note**: You need to provide all environment variables from the `.env` file or any other convenient way.

2. Declare MongoDB and Redis services in `docker-compose.yml`. 
> Important, **MongoDB** version should be `8.0+`, and **Redis** should be `8.0+`.

3. Start the services:
```bash
docker compose up -d
```

### Bare Metal

1. **Install dependencies:**
   ```bash
   # Install Bun.js
   curl -fsSL https://bun.sh/install | bash
   
   # Install packages
   bun install
   ```
> Important! Don't forget to deploy dependent services: Redis, MongoDB and Caddy if needed.

2. **Configure environment variables:**
   ```bash
   cp .env.sample .env
   # Edit .env with settings for MongoDB, Redis and OpenRouter
   ```

3. **Start:**
   ```bash
   # Development
   bun run dev
   
   # Production
   bun run build
   bun run start
   ```

**⚠️ Important:** Make sure to configure environment variables from the `.env.sample` file before running. Pay special attention to `OPENROUTER_API_KEY`, `MONGODB_URI` and `REDIS_URL` and prompts.

### Bare Metal

Requirements:
- Bun 1.0+
- PostgreSQL 13+
- Redis 6.0+

1. Install dependencies:
```bash
curl -fsSL https://bun.sh/install | bash
bun install
```

2. Configure environment variables:
```bash
cp .env.sample .env
# Edit .env with settings for PostgreSQL, Redis and OpenRouter
```

3. Run database migrations:
```bash
bun run migrate
```

4. Run the server:
```bash
# Development
bun run dev

# Production
bun run build
bun run start
```

### Runtime Configuration

API users can override the OpenRouter token with their own:

```bash
# Send header in request:
X-OpenRouter-Token: sk-or-your-custom-token
```

This allows using your own OpenRouter billing and pricing.

## Tech Stack

- **TypeScript** — main development language
- **Bun.js** — fast JS runtime and package manager
- **Mastra** — the agent, tools, and streaming on top of the AI SDK
- **AI SDK + @openrouter/ai-sdk-provider** — access to OpenRouter models
- **zod** — request and tool schemas
- **MongoDB + Mongoose** — users and metrics
- **Redis** — chat history
- **Caddy** — reverse proxy and SSL termination
- **Docker + Docker Compose** — containerization and orchestration
- **tslog** — structured logging

## AI Participation

AI tools were used selectively for specific tasks: optimizing prompts for OpenRouter, generating part of the documentation, and refactoring some TypeScript types. The main architecture, business logic, and critical components were developed manually. Commits were fully written by an AI agent, with AI participation minimized where possible.

The move to Mastra and protocol v2 (the agent with tools, streaming, new prompts, tests) was done entirely by the Claude AI agent from my brief.

## Related projects

[Allay for Minecraft](https://github.com/allay-ai/minecraft)—💬 brings Allay into the game: ask the AI anything with `/ask`, right in the chat, in each player's language. 🎮

## From the same author

[Mo’Joins](https://github.com/MairwunNx/mojoins)—🎉 greets players in their own language: join and quit lines, a welcome for newcomers, sounds, and particles.

[Mo’Afks](https://github.com/MairwunNx/moafks)—🛡️ a safe AFK mode: no damage, no pushing, mobs ignore you, and AFK players don't block the night.

[Mo’Bosses](https://github.com/mairwunnx/mobosses)—🏆 an RPG plugin that turns ordinary mobs into epic bosses, with a deep player progression system.

## License

MIT, see [LICENSE](https://github.com/allay-ai/server/blob/master/LICENSE).

> 🫡 Made by Pavel Erokhin (Павел Ерохин), aka mairwunnx.
