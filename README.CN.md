# 🛠️ McBuddy Server

[![AI Capable](https://img.shields.io/badge/AI-Capable-brightgreen?style=flat&logo=openai&logoColor=white)](https://github.com/mcbuddy-ai/mcbuddy-server)
[![GitHub Release](https://img.shields.io/github/v/release/mcbuddy-ai/mcbuddy-server?style=flat&logo=github&color=blue)](https://github.com/mcbuddy-ai/mcbuddy-server/releases)
[![Docker](https://img.shields.io/badge/Docker-Available-2496ED?style=flat&logo=docker&logoColor=white)](https://github.com/mcbuddy-ai/mcbuddy-server/pkgs/container/mcbuddy-server)
[![Bun](https://img.shields.io/badge/Bun-1.2.18-000000?style=flat&logo=bun&logoColor=white)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.0.15-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-8.2-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)

**语言**: [🇷🇺 Русский](README.md) | [🇺🇸 English](README.EN.md) | 🇨🇳 中文

**McBuddy Server** — 🛠️⚡ MCBuddy AI 助手的后端 — 基于 Bun 的快速服务器，集成 OpenRouter 和网络搜索，处理来自 Minecraft 和 Telegram 的请求。提供 REST API 以获取带上下文和聊天历史的 Minecraft AI 答案。🌟

> **注意**：这是 MCBuddy 生态系统的主要后端，为所有客户端提供 AI 答案。

## 工作原理

MCBuddy Server 是一个基于 OpenRouter 的 [Mastra](https://mastra.ai) 智能体，在 Minecraft 和 Telegram 中回答玩家的问题。在游戏中，它能看到提问玩家的状态：背包、生命值、周围环境，以及该服务器的配方。需要最新信息时，它会自行上网搜索。

插件为每个问题发起一个流式请求 `POST /api/v2/chat`，服务器在智能体工作时以 Server-Sent Events 返回：

- `reasoning` —— 模型的推理片段（如果模型提供）；
- `tool_call` —— 智能体需要游戏中的信息（例如背包）。插件执行工具后，将结果发送到 `POST /api/v2/chat/{run_id}/tools/{call_id}`；
- `tool_status` —— 智能体当前在做什么：查看背包、搜索网络；
- `text` —— 逐步生成的回答，最后是 `usage` 和 `done`。

对于 `/askx`，返回的是包含命令列表的 `commands` 事件。完整协议见 [docs/protocol-v2.md](docs/protocol-v2.md)。

游戏工具只能看到提问的玩家及其周围的世界，看不到其他玩家的坐标和背包。除了读取信息，所有玩家还能使用无害的操作：让指南针指向某个位置、整理背包、设置提醒和使用笔记本。智能体可以把笔记绑定到某个地点（“这里有卖箭的村民”），之后根据随口的提问找到它并指路。它还能查看箱子里的物品，计算耐久、经验和食物，告诉你该在哪里放火把，并估算农场的产量。给予物品、传送、更改游戏模式、时间或天气的工具只提供给管理员（OP），即使插件提供了这些工具，后端也会对其他玩家丢弃它们。

后端运行三类工具：

- `search_web`：通过搜索模型联网搜索，由智能体自行决定何时搜索；
- `exact_calculations`：用 [math.js](https://mathjs.org) 以 64 位有效数字精确计算：堆叠数量、下界坐标、经验、单位换算。每个表达式在独立的 worker 中最多运行 1 秒；
- `remember` 和 `forget`：维护关于玩家的长期记忆。

智能体用提问所用的语言回答，只有在消息看不出语言时才参考游戏语言设置。

### 记忆

每个玩家有一个会话和一份长期记忆。会话保存在 Redis 中，最后一次提问后保留 24 小时，包含最近 8 到 12 轮原文以及更早内容的简短摘要。摘要由模型在回答发出后生成，玩家无需等待。`/askx` 请求以一行记录进入会话：请求内容和生成的命令。

长期记忆保存在 MongoDB 中，不会过期，最多 30 条简短事实：基地位置、玩家正在做的事、偏好的回答方式。智能体会自行保存并告知玩家。插件通过协议中描述的 `/api/v2/users/{user_id}/…` 接口为玩家提供 `/ask new`、`/ask memory` 和 `/ask forget`。

`POST /api/ask` 和 `POST /api/askx` 保持不变，供 Telegram 机器人和 2.0 之前的插件使用：同一个智能体，但没有游戏工具，一次返回 JSON。两个 API 版本共享同一个会话。

> 等待中的工具调用保存在进程内存中，因此服务器按单实例设计。

## 环境变量

主要变量：`OPENROUTER_API_KEY`（必填）、`OPENROUTER_API_MODEL`（必须支持工具调用，默认 `openai/gpt-6-luna`）、`SEARCH_MODEL`（联网搜索模型，默认 `perplexity/sonar`）、`OPENROUTER_API_CTX`、`OPENROUTER_REASONING_EFFORT`、`TOOL_TIMEOUT_MS`（默认 15000）、`MAX_AGENT_STEPS`（默认 8）、`MAX_ACTIVE_RUNS`、`SSE_PING_MS`、`CHAT_TTL_SECONDS`（会话保留时间，默认 86400）、`CALC_TIMEOUT_MS`（默认 1000）。旧的 `SYSTEM_MESSAGE*` 变量已不再读取，提示词只在 `src/prompts` 中修改。如果主模型设为 `perplexity/…`（不支持工具调用），服务器会自动把它用于搜索，并用默认模型回答。完整说明见俄文 README。

提示词位于 [src/prompts](src/prompts)，随构建一起打包。

玩家和机器人可以发送请求头 `X-OpenRouter-Token: sk-or-...` 来使用自己的 OpenRouter 密钥。

## 部署

### Docker Compose（推荐用于生产环境）

1. **准备配置：**
   ```bash
   # 克隆仓库
   git clone https://github.com/mcbuddy-ai/mcbuddy-server
   cd mcbuddy-server
   
   # 复制环境变量示例
   cp .env.sample .env
   
   # 使用您的设置编辑 .env 文件
   nano .env
   ```

2. **域名设置：**
   ```bash
   # 编辑 Caddyfile 并将 mcbuddy.ru 替换为您的域名
   nano configurations/caddy/Caddyfile
   ```

3. **启动：**
   ```bash
   docker compose up -d
   ```

4. **检查状态：**
   ```bash
   docker compose logs -f mcbuddy-server
   ```

### 使用预构建镜像的 Docker Compose

如果您想使用预构建镜像并自行管理 MongoDB/Redis：

1. 在 `docker-compose.yml` 中声明 mcbuddy-server 服务：

```yaml
services:
  mcbuddy-server:
    image: ghcr.io/mcbuddy-ai/mcbuddy-server:1.3.3
    env_file: .env
    environment:
      MONGODB_URI: ${MONGODB_URI}
      REDIS_URL: ${REDIS_URL}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      # ... 其他环境变量
```

> **注意**：您需要从 `.env` 文件或其他任何方便的方式提供所有环境变量。

2. 在 `docker-compose.yml` 中声明 MongoDB 和 Redis 服务。
> 重要，**MongoDB** 版本应为 `8.0+`，**Redis** 应为 `8.0+`。

3. 启动服务：
```bash
docker compose up -d
```

5. 检查状态：
```bash
docker compose logs -f mcbuddy-server
curl http://localhost:3000/api/health
```

### 裸机部署

要求：
- Bun 1.0+
- PostgreSQL 13+
- Redis 6.0+

1. 安装依赖项：
```bash
curl -fsSL https://bun.sh/install | bash
bun install
```

2. 配置环境变量：
```bash
cp .env.sample .env
# 使用 PostgreSQL、Redis 和 OpenRouter 的设置编辑 .env
```

3. 运行数据库迁移：
```bash
bun run migrate
```

4. 运行服务器：
```bash
# 开发环境
bun run dev

# 生产环境
bun run build
bun run start
```

### 运行时配置

API 用户可以使用自己的 OpenRouter 令牌覆盖：

```bash
# 在请求中发送标头：
X-OpenRouter-Token: sk-or-your-custom-token
```

这允许使用您自己的 OpenRouter 计费和定价。

## 技术栈

- **TypeScript** — 主要开发语言
- **Bun.js** — 快速的 JS 运行时和包管理器
- **MongoDB + Mongoose** — 主数据库，带有类型安全的 ODM
- **Redis + ioredis** — 聊天历史和会话缓存
- **BullMQ** — 队列系统和后台任务
- **Caddy** — 反向代理和 SSL 终止
- **OpenRouter** — 用于访问各种 AI 模型的 API
- **Mastra** — 基于 AI SDK 的智能体、工具和流式输出
- **zod** — 请求和工具的模式校验
- **Docker + Docker Compose** — 容器化和编排
- **tslog** — 结构化日志记录

## AI 参与

AI 工具被选择性地用于特定任务：优化 OpenRouter 的提示、生成部分文档以及重构一些 TypeScript 类型。主要架构、业务逻辑和关键组件是手动开发的。提交完全由 AI 代理编写，在可能的情况下尽量减少 AI 参与。

## 相关项目链接

[McBuddy Bot](https://github.com/mcbuddy-ai/mcbuddy-bot) — 🤖 用于与 MCBuddy 通信的 Telegram 机器人 — 询问有关 Minecraft 的问题并立即获得清晰、准确的答案！📱

[McBuddy Spigot](https://github.com/mcbuddy-ai/mcbuddy-spigot) — 💬 MCBuddy 集成的 Spigot 插件 — 添加 `/ask` 命令，直接在 Minecraft 服务器聊天中向 AI 助手提问！🎮

## 来自"同一作者"系列

[Xi Manager](https://github.com/mairwunnx/xi) — 🀄️ 基于 AI 的 Telegram 机器人，风格化为 Xi 的私人助理。伟大领袖的私人助理，随时准备回答人民群众的问题。

[Dickobrazz](https://github.com/mairwunnx/dickobrazz) — 🌶️ Dickobrazz 机器人，又名 dicobot，能够精确到厘米测量你的单位大小。现代化的技术型测量器，带有赛季系统和游戏化。

[Louisepizdon](https://github.com/MairwunNx/louisepizdon) — 🥀 Louisepizdon，一个比你奶奶还诚实的 AI Telegram 机器人。会正确评估你，根据照片分析你衣服的定价！

[Mo'Bosses](https://github.com/mairwunnx/mobosses) — 🏆 **Mo'Bosses** 是最好的 RPG 插件，将普通的怪物转变为史诗级的 Boss，拥有**高级玩家进阶系统**。与其他插件不同，这里每场战斗都很重要，每个等级都会开启新的可能性！⚔

[Mo'Joins](https://github.com/mairwunnx/mojoins) — 🎉 自定义加入/退出：消息、声音、粒子、烟花和加入后的保护。全部用于 PaperMC。

[Mo'Afks](https://github.com/mairwunnx/moafks) — 🛡️ 在线时间暂停 — 现在可能了。PaperMC 插件，为玩家提供安全的 AFK 模式：伤害免疫、无碰撞、被怪物忽略、自动检测不活动和整洁的视觉效果。

---

![image](./media.png)

🇷🇺 **在俄罗斯用爱制作。** ❤️

**McBuddy** — 是对 Minecraft 游戏和现代技术的热爱的结晶。该项目是为俄语游戏社区创建的，注重代码质量和用户体验。

> 🫡 Made by Pavel Erokhin (Павел Ерохин), aka mairwunnx.

