import type {
  StorageChecksumAlgorithm,
  StorageConfig,
  StorageEncryptionMode,
  StorageSecurityPolicy,
} from '@/types';

export const DEFAULT_STORAGE_ENCRYPTION_MODE: StorageEncryptionMode = 'AES256';
export const DEFAULT_STORAGE_CHECKSUM_ALGORITHM: StorageChecksumAlgorithm = 'SHA256';
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

export const DEFAULT_STORAGE_POLICY: StorageSecurityPolicy = {
  encryptionMode: DEFAULT_STORAGE_ENCRYPTION_MODE,
  checksumAlgorithm: DEFAULT_STORAGE_CHECKSUM_ALGORITHM,
  signedUrlTtlSeconds: DEFAULT_SIGNED_URL_TTL_SECONDS,
};

function isValidTtl(value?: number) {
  return Number.isFinite(value) && (value || 0) > 0;
}

export function resolveStoragePolicy(
  config: Partial<Pick<StorageConfig, 'encryptionMode' | 'checksumAlgorithm' | 'signedUrlTtlSeconds'>> = {},
): StorageSecurityPolicy {
  return {
    encryptionMode: config.encryptionMode || DEFAULT_STORAGE_POLICY.encryptionMode,
    checksumAlgorithm: config.checksumAlgorithm || DEFAULT_STORAGE_POLICY.checksumAlgorithm,
    signedUrlTtlSeconds: isValidTtl(config.signedUrlTtlSeconds)
      ? Math.floor(config.signedUrlTtlSeconds as number)
      : DEFAULT_STORAGE_POLICY.signedUrlTtlSeconds,
  };
}

