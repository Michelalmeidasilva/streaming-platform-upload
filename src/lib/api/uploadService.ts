import { createStorageAdapter } from '@/lib/storage';
import { UploadService } from '@/lib/services/UploadService';
import { initializeEventDispatcher } from '@/lib/events/EventDispatcher';
import { getRecoveryPolicy } from '@/lib/security/recovery-policy';
import { resolveStoragePolicy } from '@/lib/security/storage-policy';
import type { StorageChecksumAlgorithm, StorageEncryptionMode } from '@/types';

initializeEventDispatcher();

const signedUrlTtlSeconds = Number.parseInt(process.env.STORAGE_SIGNED_URL_TTL_SECONDS || '', 10);
const storagePolicy = resolveStoragePolicy({
  encryptionMode: process.env.STORAGE_ENCRYPTION_MODE as StorageEncryptionMode | undefined,
  checksumAlgorithm: process.env.STORAGE_CHECKSUM_ALGORITHM as StorageChecksumAlgorithm | undefined,
  signedUrlTtlSeconds: Number.isFinite(signedUrlTtlSeconds) ? signedUrlTtlSeconds : undefined,
});

const storage = createStorageAdapter({
  provider: process.env.STORAGE_PROVIDER as 's3' | 'minio' || 'minio',
  bucket: process.env.STORAGE_BUCKET || 'videos',
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  ...storagePolicy,
});

// Carry versioning, backup, and replication posture forward for auditability.
export const uploadService = new UploadService(storage, {
  storage: storagePolicy,
  recovery: getRecoveryPolicy(),
});
export const storageAdapter = storage;
