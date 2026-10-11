# 🛠️ McBuddy Server

[![AI Capable](https://img.shields.io/badge/AI-Capable-brightgreen?style=flat&logo=openai&logoColor=white)](https://github.com/mcbuddy-ai/mcbuddy-server)
[![GitHub Release](https://img.shields.io/github/v/release/mcbuddy-ai/mcbuddy-server?style=flat&logo=github&color=blue)](https://github.com/mcbuddy-ai/mcbuddy-server/releases)
[![Docker](https://img.shields.io/badge/Docker-Available-2496ED?style=flat&logo=docker&logoColor=white)](https://github.com/mcbuddy-ai/mcbuddy-server/pkgs/container/mcbuddy-server)
[![Bun](https://img.shields.io/badge/Bun-1.2.18-000000?style=flat&logo=bun&logoColor=white)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.0.15-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-8.2-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)

**Language**: [🇷🇺 Русский](README.md) | 🇺🇸 English | [🇨🇳 中文](README.CN.md)

**McBuddy Server** — 🛠️⚡ Backend for MCBuddy AI assistant — fast server on Bun with OpenRouter integration and web search, processing requests from Minecraft and Telegram. Provides REST API for getting AI answers about Minecraft with context and chat history. 🌟

> **Note**: This is the main backend for the MCBuddy ecosystem, providing AI answers for all clients.

## How it works

MCBuddy Server is a [Mastra](https://mastra.ai) agent on top of OpenRouter that answers players in Minecraft and in Telegram. In the game it sees what is going on with the player who asks: inventory, health, surroundings, the recipes of that server. It searches the web on its own when a question needs fresh facts.

The plugin opens one streaming request, `POST /api/v2/chat`, per question. The server answers with Server-Sent Events while the agent works:

- `reasoning` – pieces of the model's reasoning, when the model exposes it;
- `tool_call` – the agent needs something from the game, such as the inventory. The plugin runs the tool and posts the result to `POST /api/v2/chat/{run_id}/tools/{call_id}`;
- `tool_status` – what the agent is doing right now: reading the inventory, searching the web;
- `text` – the answer as it's written, then `usage` and `done`.

For `/askx`, a `commands` event with the command list replaces the text. The full protocol is in [docs/protocol-v2.md](docs/protocol-v2.md).

Game tools only see the player who asked and the world around them; other players' coordinates and inventories stay out of reach. The plugin sends the list of tools it offers, so a server admin can switch any of them off. Besides reading, everyone gets harmless actions: pointing the compass at a spot, sorting the inventory, a reminder. Tools that give items, teleport, or change the game mode, time, or weather go to operators only. The backend drops them for everyone else, even if a plugin offers them.

Three tools run on the backend:

- `search_web` searches the web through a search model. The agent decides when it's worth it instead of searching for every question;
- `exact_calculations` evaluates expressions exactly with [math.js](https://mathjs.org) at 64 significant digits: stacks, Nether coordinates, XP, unit conversions. Each expression runs in a worker for at most a second;
- `remember` and `forget` keep a lasting memory about the player.

The agent answers in the language of the question. The game locale only matters when the message has no clear language.

### Memory

Each player has a session and a lasting memory. The session lives in Redis for 24 hours after the last question. It holds the last 8 to 12 questions verbatim and a short summary of everything before them. The model writes that summary after the answer, so the player never waits for it. `/askx` requests land in the session as one line: what was asked and which commands came out.

The lasting memory sits in MongoDB and never expires. It's up to 30 short facts: where the base is, what the player is working on, how they like answers. The agent saves them itself and says so. The plugin gives players `/ask new`, `/ask memory`, and `/ask forget` through the `/api/v2/users/{user_id}/…` endpoints described in the protocol.

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
| `CALC_TIMEOUT_MS` | How long `exact_calculations` gives one expression | `1000` |

Prompts live in [src/prompts](src/prompts) (`minecraft-ask.md`, `minecraft-askx.md`, `telegram.md`) and ship inside the build. Each run appends who asks, their language, the server version, and the available tools. Remove old `SYSTEM_MESSAGE*` variables to switch to the new prompts. The old `SYSTEM_MESSAGE*` variables are no longer read. A `perplexity/…` main model can’t call tools, so the server moves it to search and answers with the default model.

## Deployment

### Docker Compose (recommended for production)

1. **Prepare configuration:**
   ```bash
   # Clone the repository
   git clone https://github.com/mcbuddy-ai/mcbuddy-server
   cd mcbuddy-server
   
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
   docker compose logs -f mcbuddy-server
   ```

### Docker Compose with pre-built image

If you want to use the pre-built image and manage MongoDB/Redis yourself:

1. Declare the mcbuddy-server service in `docker-compose.yml`:

```yaml
services:
  mcbuddy-server:
    image: ghcr.io/mcbuddy-ai/mcbuddy-server:1.3.3
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

## Links to Related Projects

[McBuddy Bot](https://github.com/mcbuddy-ai/mcbuddy-bot) — 🤖 Telegram bot for communicating with MCBuddy — ask about Minecraft and instantly get clear, accurate answers! 📱

[McBuddy Spigot](https://github.com/mcbuddy-ai/mcbuddy-spigot) — 💬 Spigot plugin for MCBuddy integration — adds `/ask` command for AI assistant questions directly in Minecraft server chat! 🎮

## From the Series "By the Same Author"

[Xi Manager](https://github.com/mairwunnx/xi) — 🀄️ AI-powered Telegram bot styled as Xi's personal assistant. A personal assistant to the great leader, ready to answer questions from the common people.

[Dickobrazz](https://github.com/mairwunnx/dickobrazz) — 🌶️ Dickobrazz bot, aka dicobot, capable of measuring your unit size to the nearest centimeter. A modern and technological cockometer with seasons system and gamification.

[Louisepizdon](https://github.com/MairwunNx/louisepizdon) — 🥀 Louisepizdon, an AI Telegram bot that's more honest than your grandmother. Will evaluate you properly, breaking down the pricing of your clothes from a photo!

[Mo'Bosses](https://github.com/mairwunnx/mobosses) — 🏆 **Mo'Bosses** is the best RPG plugin that transforms ordinary mobs into epic bosses with an **advanced player progression system**. Unlike other plugins, here every fight matters, and each level opens new possibilities! ⚔

[Mo'Joins](https://github.com/mairwunnx/mojoins) — 🎉 Custom joins/quits: messages, sounds, particles, fireworks, and protection after joining. All for PaperMC.

[Mo'Afks](https://github.com/mairwunnx/moafks) — 🛡️ Pause in online time — now possible. A plugin for PaperMC that gives players a safe AFK mode: damage immunity, no collisions, ignored by mobs, auto-detect inactivity, and neat visual effects.

---

![image](./media.png)

🇷🇺 **Made in Russia with love.** ❤️

**McBuddy** — is the result of love for Minecraft and modern technologies. The project is created for the Russian-speaking gaming community, with care for code quality and user experience.

> 🫡 Made by Pavel Erokhin (Павел Ерохин), aka mairwunnx.
