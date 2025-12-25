# Context8

Context8 是一个面向私有代码仓库的智能上下文平台，功能对标 [Context7](https://context7.com)，通过 MCP (Model Context Protocol) 协议为 AI 编码助手（Cursor、Claude Desktop、Windsurf）提供私有代码库的语义检索能力。

## 功能特性

- **私有代码索引**: 连接本地目录或远程仓库，使用 Tree-sitter 进行 AST 语义分块
- **混合检索**: 结合向量语义搜索和 BM25 关键词搜索，通过 RRF 融合
- **MCP 协议支持**: 标准 MCP 工具，可直接在 Cursor/Claude Desktop 中使用
- **Wiki 生成**: 使用 LLM 自动生成代码库的 Wiki 文档
- **Web 控制台**: 管理项目、搜索代码、监控任务、配置设置

## 截图

### 首页 - 项目管理

管理已索引的代码库，支持添加本地目录或远程仓库。

![首页](docs/screenshots/home.png)

### Context7 般的菜谱

![Cookbook](docs/screenshots/project.png)

### 语义搜索

跨代码库进行语义搜索，支持按 Token 限制过滤结果，可选择 Code 或 Info 模式。

![搜索页面](docs/screenshots/search.png)

### 任务监控

实时监控索引任务的进度和历史，查看处理状态和统计信息。

![任务页面](docs/screenshots/tasks.png)

### 设置

配置 AI 模型提供商，包括 Embedding 模型和 LLM 模型的 API 设置。

![设置页面](docs/screenshots/settings.png)

## 项目结构

```
context8/
├── apps/
│   ├── mcp-server/          # MCP 协议网关
│   ├── web/                 # Next.js Web 控制台
│   ├── worker/              # 后台任务处理器
│   └── cli/                 # 命令行工具
│
├── packages/
│   ├── database/            # Prisma ORM + PostgreSQL
│   ├── embedding/           # Embedding 模型客户端
│   ├── indexer/             # 代码索引逻辑
│   ├── parser/              # Tree-sitter AST 解析 + 分块
│   ├── retriever/           # 混合检索 (向量 + BM25)
│   ├── types/               # 共享 TypeScript 类型
│   └── vector-store/        # Qdrant 向量数据库客户端
│
├── mcp/                     # 独立 MCP 客户端包
│
└── deploy/
    └── docker-compose.yml   # 开发环境基础设施
```

## 快速开始

### 1. 安装依赖

```bash
# 安装 pnpm (如果还没有)
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 2. 启动基础设施

```bash
# 启动 PostgreSQL, Redis, Qdrant
pnpm docker:up
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
pnpm db:generate

# 执行数据库迁移
pnpm db:push
```

### 4. 启动开发服务

```bash
# 启动所有服务
pnpm dev
```

## MCP 工具

### resolve-library-id

将库名称解析为 Context8 库 ID。

```json
{
  "libraryName": "payment-service"
}
```

### get-library-docs

根据库 ID 获取文档。

```json
{
  "context8CompatibleLibraryID": "/org/project",
  "topic": "authentication",
  "mode": "code"
}
```

### get-wiki-docs

获取库的 Wiki 文档。

```json
{
  "context8CompatibleLibraryID": "/org/project",
  "topic": "architecture"
}
```

### delete-project

删除项目及其所有索引数据。

```json
{
  "projectId": "project-uuid"
}
```

## 配置 IDE

### Cursor / Claude Desktop

在 MCP 配置文件中添加:

```json
{
  "mcpServers": {
    "context8": {
      "command": "node",
      "args": ["/path/to/context8/apps/mcp-server/dist/bin/local.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/context8",
        "QDRANT_HOST": "localhost",
        "QDRANT_PORT": "6333"
      }
    }
  }
}
```

## 环境变量

复制 `.env.example` 到 `.env` 并配置:

```bash
cp .env.example .env
```

主要配置项:

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://postgres:postgres@localhost:5432/context8` |
| `QDRANT_HOST` | Qdrant 服务地址 | `localhost` |
| `QDRANT_PORT` | Qdrant 服务端口 | `6333` |
| `VOYAGE_API_KEY` | Voyage AI API Key (代码嵌入) | - |
| `OPENAI_API_KEY` | OpenAI API Key (Wiki 生成) | - |

## 技术栈

- **运行时**: Node.js 20+ / TypeScript 5.3+
- **Monorepo**: pnpm + Turborepo
- **框架**: MCP SDK, Next.js (Web)
- **数据库**: PostgreSQL 15 + Prisma
- **向量数据库**: Qdrant
- **代码解析**: Tree-sitter
- **嵌入模型**: Voyage code-3
- **任务队列**: BullMQ + Redis

## 开发

```bash
# 构建所有包
pnpm build

# 类型检查
pnpm typecheck

# 运行测试
pnpm test
```

## 联系作者

加作者微信拉你进 context8 天使群

![微信](docs/assets/wechat_personal.png)

## 许可证

MIT
