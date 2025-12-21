import { QdrantClient } from '@context8/vector-store';

// Parse host - handle URLs like https://xxx.cloud.qdrant.io
let host = process.env.QDRANT_HOST ?? 'localhost';
let https = process.env.QDRANT_HTTPS === 'true';

// Auto-detect https from URL format
if (host.startsWith('https://')) {
  host = host.replace('https://', '');
  https = true;
} else if (host.startsWith('http://')) {
  host = host.replace('http://', '');
  https = false;
}

const config = {
  host,
  port: parseInt(process.env.QDRANT_PORT ?? '6333'),
  apiKey: process.env.QDRANT_API_KEY,
  https,
};

const collectionName = process.env.QDRANT_COLLECTION ?? 'codebase_v1';

export const qdrantClient = new QdrantClient(config, collectionName);
