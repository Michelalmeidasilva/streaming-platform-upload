import { createStorageAdapter } from '@/lib/storage';
import { UploadService } from '@/lib/services/UploadService';
import { initializeEventDispatcher } from '@/lib/events/EventDispatcher';
import { getRecoveryPolicy } from '@/lib/security/recovery-policy';
import { resolveStoragePolicy } from '@/lib/security/storage-policy';
import type { StorageChecksumAlgorithm, StorageEncryptionMode } from '@/types';

initializeEventDispatcher();

declare global {
  // eslint-disable-next-line no-var
  var __uploadServiceSingleton__:
    | {
        uploadService: UploadService;
        storageAdapter: ReturnType<typeof createStorageAdapter>;
      }
    | undefined;
}

const signedUrlTtlSeconds = Number.parseInt(process.env.STORAGE_SIGNED_URL_TTL_SECONDS || '', 10);
const storageProvider = (process.env.STORAGE_PROVIDER as 's3' | 'minio' | 'memory') || 'minio';
const encryptionEnabled = process.env.STORAGE_ENCRYPTION_ENABLED !== 'false';
const storagePolicy = resolveStoragePolicy({
  encryptionEnabled,
  encryptionMode: process.env.STORAGE_ENCRYPTION_MODE as StorageEncryptionMode | undefined,
  checksumAlgorithm: process.env.STORAGE_CHECKSUM_ALGORITHM as StorageChecksumAlgorithm | undefined,
  signedUrlTtlSeconds: Number.isFinite(signedUrlTtlSeconds) ? signedUrlTtlSeconds : undefined,
});

function resolveStorageConfig() {
  if (storageProvider === 's3') {
    return {
      provider: storageProvider,
      bucket: process.env.STORAGE_BUCKET || 'videos',
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      ...storagePolicy,
    } as const;
  }

  if (storageProvider === 'minio') {
    return {
      provider: storageProvider,
      bucket: process.env.STORAGE_BUCKET || 'videos',
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      forcePathStyle: true,
      ...storagePolicy,
    } as const;
  }

  return {
    provider: storageProvider,
    bucket: process.env.STORAGE_BUCKET || 'videos',
    ...storagePolicy,
  } as const;
}

function createSingletons() {
  const storage = createStorageAdapter(resolveStorageConfig());

  return {
    storageAdapter: storage,
    uploadService: new UploadService(storage, {
      storage: storagePolicy,
      recovery: getRecoveryPolicy(),
    }),
  };
}

const singletons = globalThis.__uploadServiceSingleton__ || createSingletons();

if (!globalThis.__uploadServiceSingleton__) {
  globalThis.__uploadServiceSingleton__ = singletons;
}

export const uploadService = singletons.uploadService;
export const storageAdapter = singletons.storageAdapter;
