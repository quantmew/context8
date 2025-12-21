import { prisma } from '../client.js';
import type { RemoteCredential, RemoteProvider } from '@prisma/client';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required for credential storage');
  }
  // Key should be 32 bytes (64 hex chars) for AES-256
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

function encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

function decrypt(encrypted: string, iv: string, tag: string): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export type CreateRemoteCredentialData = {
  provider: RemoteProvider;
  name: string;
  token: string; // Plain text token, will be encrypted
};

export type RemoteCredentialWithToken = RemoteCredential & {
  decryptedToken?: string;
};

export class RemoteCredentialRepository {
  async findById(id: string): Promise<RemoteCredential | null> {
    return prisma.remoteCredential.findUnique({
      where: { id },
    });
  }

  async findByIdWithToken(id: string): Promise<RemoteCredentialWithToken | null> {
    const credential = await prisma.remoteCredential.findUnique({
      where: { id },
    });

    if (!credential) return null;

    try {
      const decryptedToken = decrypt(
        credential.encryptedToken,
        credential.tokenIv,
        credential.tokenTag
      );
      return { ...credential, decryptedToken };
    } catch (error) {
      console.error('Failed to decrypt token:', error);
      return credential;
    }
  }

  async findAll(): Promise<RemoteCredential[]> {
    return prisma.remoteCredential.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findByProvider(provider: RemoteProvider): Promise<RemoteCredential[]> {
    return prisma.remoteCredential.findMany({
      where: { provider },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(data: CreateRemoteCredentialData): Promise<RemoteCredential> {
    const { encrypted, iv, tag } = encrypt(data.token);

    return prisma.remoteCredential.create({
      data: {
        provider: data.provider,
        name: data.name,
        encryptedToken: encrypted,
        tokenIv: iv,
        tokenTag: tag,
      },
    });
  }

  async updateToken(id: string, token: string): Promise<RemoteCredential> {
    const { encrypted, iv, tag } = encrypt(token);

    return prisma.remoteCredential.update({
      where: { id },
      data: {
        encryptedToken: encrypted,
        tokenIv: iv,
        tokenTag: tag,
      },
    });
  }

  async updateName(id: string, name: string): Promise<RemoteCredential> {
    return prisma.remoteCredential.update({
      where: { id },
      data: { name },
    });
  }

  async updateLastUsed(id: string): Promise<void> {
    await prisma.remoteCredential.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.remoteCredential.delete({
      where: { id },
    });
  }

  async getDecryptedToken(id: string): Promise<string | null> {
    const credential = await this.findByIdWithToken(id);
    return credential?.decryptedToken ?? null;
  }
}

export const remoteCredentialRepository = new RemoteCredentialRepository();
