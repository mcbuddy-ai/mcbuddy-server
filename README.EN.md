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

## Features

### Core Functionality

- **REST API** — `/api/ask` and `/api/askx` endpoints for getting AI answers
- **OpenRouter integration** — access to various AI models through a single API
- **Web search** — advanced internet search for accurate answers
- **Contextual memory** — preserving dialogue history via Redis
- **Usage metrics** — tracking requests and AI costs

### Management System

- **User tokens** — ability to use custom OpenRouter token
- **Response caching** — Redis for fast access to history
- **Database** — MongoDB for storing users and metrics
- **Task queues** — BullMQ for background task processing
- **Health check** — service status monitoring

### API Endpoints

- **POST /api/ask** — send a question to the AI assistant
- **POST /api/askx** — perform an action via AI (command generation)
- **GET /api/health** — check service status

## Usage

### API Examples

#### Request to /api/ask

```bash
curl -X POST https://mcbuddy.ru/api/ask \
  -H "Content-Type: application/json" \
  -H "X-OpenRouter-Token: sk-or-your-token" \
  -d '{
    "question": "How to craft a diamond pickaxe?",
    "userId": "user123"
  }'
```

#### Request to /api/askx

```bash
curl -X POST https://mcbuddy.ru/api/askx \
  -H "Content-Type: application/json" \
  -H "X-OpenRouter-Token: sk-or-your-token" \
  -d '{
    "action": "give player a diamond sword",
    "userId": "user123",
    "targetPlayer": "Steve"
  }'
```

### API Response

```json
{
  "answer": "To craft a diamond pickaxe you need...",
  "model": "anthropic/claude-3-haiku",
  "tokens": 150,
  "cached": false
}
```

## Compatibility

- **REST API** — works with any HTTP clients
- **Database**: MongoDB 8.0+
- **Cache**: Redis 8.0+
- **Runtime**: Bun 1.0+
- **Deployment**: Docker + Docker Compose
- **Proxy**: Caddy for SSL and routing

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
    image: ghcr.io/mcbuddy-ai/mcbuddy-server:1.3.0
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
- **PostgreSQL + Drizzle ORM** — main database with type-safe ORM
- **Redis + ioredis** — chat history and session caching
- **BullMQ** — queue system and background tasks
- **Caddy** — reverse proxy and SSL termination
- **OpenRouter** — API for accessing various AI models
- **fp-ts** — functional programming in TypeScript
- **Docker + Docker Compose** — containerization and orchestration
- **tslog** — structured logging

## AI Participation

AI tools were used selectively for specific tasks: optimizing prompts for OpenRouter, generating part of the documentation, and refactoring some TypeScript types. The main architecture, business logic, and critical components were developed manually. Commits were fully written by an AI agent, with AI participation minimized where possible.

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
