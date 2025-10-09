# 🛠️ McBuddy Server

[![AI Capable](https://img.shields.io/badge/AI-Capable-brightgreen?style=flat&logo=openai&logoColor=white)](https://github.com/mcbuddy-ai/mcbuddy-server)
[![Docker](https://img.shields.io/badge/Docker-Available-2496ED?style=flat&logo=docker&logoColor=white)](https://github.com/mcbuddy-ai/mcbuddy-server)
[![Bun](https://img.shields.io/badge/Bun-1.0+-000000?style=flat&logo=bun&logoColor=white)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-336791?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

**语言**: [🇷🇺 Русский](README.md) | [🇺🇸 English](README.EN.md) | 🇨🇳 中文

**McBuddy Server** — 🛠️⚡ MCBuddy AI 助手的后端 — 基于 Bun 的快速服务器，集成 OpenRouter 和网络搜索，处理来自 Minecraft 和 Telegram 的请求。提供 REST API 以获取带上下文和聊天历史的 Minecraft AI 答案。🌟

> **注意**：这是 MCBuddy 生态系统的主要后端，为所有客户端提供 AI 答案。

## 功能特性

### 核心功能

- **REST API** — `/api/ask` 和 `/api/askx` 端点用于获取 AI 答案
- **OpenRouter 集成** — 通过单一 API 访问各种 AI 模型
- **网络搜索** — 高级互联网搜索以获得准确答案
- **上下文记忆** — 通过 Redis 保留对话历史
- **使用指标** — 跟踪请求和 AI 成本

### 管理系统

- **用户令牌** — 可以使用自定义 OpenRouter 令牌
- **响应缓存** — Redis 用于快速访问历史记录
- **数据库** — PostgreSQL 用于存储用户和指标
- **任务队列** — BullMQ 用于后台任务处理
- **健康检查** — 服务状态监控

### API 端点

- **POST /api/ask** — 向 AI 助手发送问题
- **POST /api/askx** — 通过 AI 执行操作（命令生成）
- **GET /api/health** — 检查服务状态

## 使用方法

### API 示例

#### 向 /api/ask 发送请求

```bash
curl -X POST https://mcbuddy.ru/api/ask \
  -H "Content-Type: application/json" \
  -H "X-OpenRouter-Token: sk-or-your-token" \
  -d '{
    "question": "如何制作钻石镐？",
    "userId": "user123"
  }'
```

#### 向 /api/askx 发送请求

```bash
curl -X POST https://mcbuddy.ru/api/askx \
  -H "Content-Type: application/json" \
  -H "X-OpenRouter-Token: sk-or-your-token" \
  -d '{
    "action": "给玩家一把钻石剑",
    "userId": "user123",
    "targetPlayer": "Steve"
  }'
```

### API 响应

```json
{
  "answer": "要制作钻石镐，你需要...",
  "model": "anthropic/claude-3-haiku",
  "tokens": 150,
  "cached": false
}
```

## 兼容性

- **REST API** — 适用于任何 HTTP 客户端
- **数据库**: PostgreSQL 13+
- **缓存**: Redis 6.0+
- **运行时**: Bun 1.0+
- **部署**: Docker + Docker Compose
- **代理**: Caddy 用于 SSL 和路由

## 部署

### Docker Compose（推荐）

1. 克隆仓库：
```bash
git clone https://github.com/mcbuddy-ai/mcbuddy-server
cd mcbuddy-server
```

2. 配置环境变量：
```bash
# 创建 .env 文件
cp .env.sample .env

# 必需的变量：
OPENROUTER_API_KEY=your_openrouter_api_key
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DATABASE=mcbuddy
POSTGRES_USERNAME=mcbuddy
POSTGRES_PASSWORD=your_secure_password
REDIS_URL=redis://redis:6379

# 可选（用于网络搜索）：
BRAVE_SEARCH_API_KEY=your_brave_api_key
```

> **注意**：在 [openrouter.ai](https://openrouter.ai/) 获取您的 OpenRouter API 密钥。

3. 配置域名（可选）：
```bash
# 编辑 Caddyfile
nano configurations/caddy/Caddyfile
# 将 mcbuddy.ru 替换为您的域名
```

4. 启动服务：
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
- **PostgreSQL + Drizzle ORM** — 主数据库，带有类型安全的 ORM
- **Redis + ioredis** — 聊天历史和会话缓存
- **BullMQ** — 队列系统和后台任务
- **Caddy** — 反向代理和 SSL 终止
- **OpenRouter** — 用于访问各种 AI 模型的 API
- **fp-ts** — TypeScript 中的函数式编程
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

![image](./media.jpg)

🇷🇺 **在俄罗斯用爱制作。** ❤️

**McBuddy** — 是对 Minecraft 游戏和现代技术的热爱的结晶。该项目是为俄语游戏社区创建的，注重代码质量和用户体验。

> 🫡 Made by Pavel Erokhin (Павел Ерохин), aka mairwunnx.

