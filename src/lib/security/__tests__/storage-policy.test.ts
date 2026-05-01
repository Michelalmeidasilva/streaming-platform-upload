import {
  DEFAULT_STORAGE_ENCRYPTION_ENABLED,
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  DEFAULT_STORAGE_CHECKSUM_ALGORITHM,
  DEFAULT_STORAGE_ENCRYPTION_MODE,
  DEFAULT_STORAGE_POLICY,
  resolveStoragePolicy,
} from '../storage-policy';

describe('storage policy', () => {
  it('exports the required defaults', () => {
    expect(DEFAULT_STORAGE_ENCRYPTION_ENABLED).toBe(true);
    expect(DEFAULT_STORAGE_ENCRYPTION_MODE).toBe('AES256');
    expect(DEFAULT_STORAGE_CHECKSUM_ALGORITHM).toBe('SHA256');
    expect(DEFAULT_SIGNED_URL_TTL_SECONDS).toBe(3600);
    expect(DEFAULT_STORAGE_POLICY).toEqual({
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });
  });

  it('resolves explicit overrides while keeping defaults for missing values', () => {
    expect(
      resolveStoragePolicy({
        encryptionEnabled: false,
        signedUrlTtlSeconds: 900,
      }),
    ).toEqual({
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 900,
    });
  });
});
