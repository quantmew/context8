import { z } from 'zod';

/**
 * MCP Server Configuration Schema
 */
export const ConfigSchema = z.object({
  server: z.object({
    port: z.number().default(3001),
    mode: z.enum(['local', 'remote']).default('local'),
  }),

  qdrant: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6333),
    apiKey: z.string().optional(),
    collectionName: z.string().default('codebase_v1'),
  }),

  database: z.object({
    url: z.string(),
  }),

  api: z.object({
    url: z.string().default('http://localhost:3000'),
    key: z.string().optional(),
  }),

  auth: z.object({
    jwtSecret: z.string().optional(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  return ConfigSchema.parse({
    server: {
      port: parseInt(process.env.MCP_PORT || '3001'),
      mode: process.env.MCP_MODE || 'local',
    },
    qdrant: {
      host: process.env.QDRANT_HOST || 'localhost',
      port: parseInt(process.env.QDRANT_PORT || '6333'),
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: process.env.QDRANT_COLLECTION || 'codebase_v1',
    },
    database: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/context8',
    },
    api: {
      url: process.env.API_URL || 'http://localhost:3000',
      key: process.env.API_KEY,
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET,
    },
  });
}
