import { createHash, randomUUID } from 'crypto';
import type { IStorageAdapter, StorageObject } from './IStorageAdapter';

type MultipartPart = {
  partNumber: number;
  buffer: Buffer;
};

type UploadTarget =
  | { type: 'put-object'; key: string }
  | { type: 'upload-part'; key: string; uploadId: string; partNumber: number };

type MemoryStorageState = {
  objects: Map<string, { body: Buffer; contentType: string; updatedAt: Date }>;
  tokens: Map<string, UploadTarget | { type: 'get-object'; key: string }>;
  multipart: Map<string, MultipartPart[]>;
};

declare global {
  // eslint-disable-next-line no-var
  var __memoryStorageState__: MemoryStorageState | undefined;
}

function getMemoryStorageState(): MemoryStorageState {
  if (!globalThis.__memoryStorageState__) {
    globalThis.__memoryStorageState__ = {
      objects: new Map(),
      tokens: new Map(),
      multipart: new Map(),
    };
  }

  return globalThis.__memoryStorageState__;
}

function buildToken(kind: 'upload' | 'download', token: string) {
  return `/api/storage/${kind}?token=${encodeURIComponent(token)}`;
}

export function resolveMemoryUploadTarget(token: string) {
  const target = getMemoryStorageState().tokens.get(token);
  if (!target || target.type === 'get-object') {
    return null;
  }
  return target;
}

export function resolveMemoryDownloadTarget(token: string) {
  const target = getMemoryStorageState().tokens.get(token);
  if (!target || target.type !== 'get-object') {
    return null;
  }
  return target;
}

export function storeMemoryUpload(
  target: UploadTarget,
  body: Buffer,
  contentType = 'application/octet-stream',
) {
  const state = getMemoryStorageState();
  if (target.type === 'put-object') {
    state.objects.set(target.key, {
      body,
      contentType,
      updatedAt: new Date(),
    });
    return createHash('md5').update(body).digest('hex');
  }

  const parts = state.multipart.get(target.uploadId) || [];
  const existingIndex = parts.findIndex(part => part.partNumber === target.partNumber);
  const record = { partNumber: target.partNumber, buffer: body };

  if (existingIndex >= 0) {
    parts[existingIndex] = record;
  } else {
    parts.push(record);
  }

  state.multipart.set(target.uploadId, parts);
  return createHash('md5').update(body).digest('hex');
}

export function readMemoryObject(key: string) {
  return getMemoryStorageState().objects.get(key) || null;
}

export class MemoryAdapter implements IStorageAdapter {
  async upload(
    file: Buffer,
    key: string,
    contentType: string,
    _checksumSHA256?: string,
  ): Promise<string> {
    getMemoryStorageState().objects.set(key, {
      body: file,
      contentType,
      updatedAt: new Date(),
    });
    return this.getSignedUrl(key);
  }

  async getUploadPresignedUrl(
    key: string,
    _contentType: string,
    _expiresIn?: number,
  ): Promise<string> {
    const token = randomUUID();
    getMemoryStorageState().tokens.set(token, { type: 'put-object', key });
    return buildToken('upload', token);
  }

  async initiateMultipartUpload(_key: string, _contentType: string): Promise<string> {
    const uploadId = randomUUID();
    getMemoryStorageState().multipart.set(uploadId, []);
    return uploadId;
  }

  async uploadPart(
    chunk: Buffer,
    key: string,
    uploadId: string,
    partNumber: number,
    _checksumSHA256?: string,
  ): Promise<string> {
    return storeMemoryUpload({ type: 'upload-part', key, uploadId, partNumber }, chunk);
  }

  async getUploadPartPresignedUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    _expiresIn?: number,
  ): Promise<string> {
    const token = randomUUID();
    getMemoryStorageState().tokens.set(token, { type: 'upload-part', key, uploadId, partNumber });
    return buildToken('upload', token);
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[],
  ): Promise<string> {
    const state = getMemoryStorageState();
    const uploadedParts = (state.multipart.get(uploadId) || [])
      .sort((a, b) => a.partNumber - b.partNumber);

    if (uploadedParts.length === 0) {
      throw new Error('Missing multipart upload parts');
    }

    if (parts.length > 0 && uploadedParts.length !== parts.length) {
      throw new Error('Multipart upload is incomplete');
    }

    const body = Buffer.concat(uploadedParts.map(part => part.buffer));
    state.objects.set(key, {
      body,
      contentType: 'application/octet-stream',
      updatedAt: new Date(),
    });
    state.multipart.delete(uploadId);
    return this.getSignedUrl(key);
  }

  async delete(key: string): Promise<void> {
    getMemoryStorageState().objects.delete(key);
  }

  async getSignedUrl(key: string, _expiresIn?: number): Promise<string> {
    const token = randomUUID();
    getMemoryStorageState().tokens.set(token, { type: 'get-object', key });
    return buildToken('download', token);
  }

  async exists(key: string): Promise<boolean> {
    return getMemoryStorageState().objects.has(key);
  }

  async listObjects(prefix?: string): Promise<StorageObject[]> {
    return Array.from(getMemoryStorageState().objects.entries())
      .filter(([key]) => !prefix || key.startsWith(prefix))
      .map(([key, object]) => ({
        key,
        size: object.body.byteLength,
        lastModified: object.updatedAt,
      }));
  }
}
