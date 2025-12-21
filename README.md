# Context8

Context8 is an intelligent context platform for private code repositories, similar to [Context7](https://context7.com). It provides semantic retrieval capabilities for private codebases to AI coding assistants (Cursor, Claude Desktop, Windsurf) via the MCP (Model Context Protocol).

## Features

- **Private Code Indexing**: Connect to local directories or remote repositories, using Tree-sitter for AST-based semantic chunking
- **Hybrid Retrieval**: Combines vector semantic search with BM25 keyword search, fused via RRF (Reciprocal Rank Fusion)
- **MCP Protocol Support**: Standard MCP tools that work directly in Cursor/Claude Desktop
- **Wiki Generation**: Auto-generate wiki documentation for your codebase using LLM
- **Web Dashboard**: Manage projects, search code, monitor tasks, and configure settings

## Screenshots

### Home - Project Management

Manage indexed codebases, add local directories or remote repositories.

![Home](docs/screenshots/home.png)

### Semantic Search

Cross-codebase semantic search with token limit filtering, supporting Code or Info mode.

![Search](docs/screenshots/search.png)

### Task Monitoring

Real-time monitoring of indexing task progress and history.

![Tasks](docs/screenshots/tasks.png)

### Settings

Configure AI model providers, including Embedding and LLM API settings.

![Settings](docs/screenshots/settings.png)

## Project Structure

```
context8/
├── apps/
│   ├── mcp-server/          # MCP protocol gateway
│   ├── web/                 # Next.js web dashboard
│   ├── worker/              # Background task processor
│   └── cli/                 # Command-line interface
│
├── packages/
│   ├── database/            # Prisma ORM + PostgreSQL
│   ├── embedding/           # Embedding model client
│   ├── indexer/             # Code indexing logic
│   ├── parser/              # Tree-sitter AST parsing + chunking
│   ├── retriever/           # Hybrid retrieval (vector + BM25)
│   ├── types/               # Shared TypeScript types
│   └── vector-store/        # Qdrant vector database client
│
├── mcp/                     # Standalone MCP client package
│
└── deploy/
    └── docker-compose.yml   # Development infrastructure
```

## Quick Start

### 1. Install Dependencies

```bash
# Install pnpm if not installed
npm install -g pnpm

# Install project dependencies
pnpm install
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL, Redis, Qdrant
pnpm docker:up
```

### 3. Initialize Database

```bash
# Generate Prisma Client
pnpm db:generate

# Run database migrations
pnpm db:push
```

### 4. Start Development Services

```bash
# Start all services
pnpm dev
```

## MCP Tools

### resolve-library-id

Resolve a library name to a Context8 library ID.

```json
{
  "libraryName": "payment-service"
}
```

### get-library-docs

Fetch documentation for a library by its ID.

```json
{
  "context8CompatibleLibraryID": "/org/project",
  "topic": "authentication",
  "mode": "code"
}
```

### get-wiki-docs

Fetch wiki documentation for a library.

```json
{
  "context8CompatibleLibraryID": "/org/project",
  "topic": "architecture"
}
```

### delete-project

Delete a project and all its indexed data.

```json
{
  "projectId": "project-uuid"
}
```

## IDE Configuration

### Cursor / Claude Desktop

Add to your MCP configuration file:

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

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Main configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/context8` |
| `QDRANT_HOST` | Qdrant service host | `localhost` |
| `QDRANT_PORT` | Qdrant service port | `6333` |
| `VOYAGE_API_KEY` | Voyage AI API Key (code embedding) | - |
| `OPENAI_API_KEY` | OpenAI API Key (for wiki generation) | - |

## Tech Stack

- **Runtime**: Node.js 20+ / TypeScript 5.3+
- **Monorepo**: pnpm + Turborepo
- **Framework**: MCP SDK, Next.js (Web)
- **Database**: PostgreSQL 15 + Prisma
- **Vector Database**: Qdrant
- **Code Parsing**: Tree-sitter
- **Embedding Model**: Voyage code-3
- **Task Queue**: BullMQ + Redis

## Development

```bash
# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Run tests
pnpm test
```

## License

MIT
