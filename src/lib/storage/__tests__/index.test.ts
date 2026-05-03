/* eslint-disable @typescript-eslint/no-explicit-any */
import { createStorageAdapter, S3Adapter, MinIOAdapter, MemoryAdapter } from '../index';
import type { StorageConfig } from '@/types';

jest.mock('../S3Adapter');
jest.mock('../MinIOAdapter');
jest.mock('../MemoryAdapter');

describe('createStorageAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates S3Adapter for s3 provider', () => {
    const config: StorageConfig = {
      provider: 's3',
      bucket: 'test-bucket',
      region: 'us-east-1',
    };

    const adapter = createStorageAdapter(config);

    expect(S3Adapter).toHaveBeenCalledWith(config);
    expect(adapter).toBeDefined();
  });

  it('creates MinIOAdapter for minio provider', () => {
    const config: StorageConfig = {
      provider: 'minio',
      bucket: 'test-bucket',
      endpoint: 'http://localhost:9000',
    };

    const adapter = createStorageAdapter(config);

    expect(MinIOAdapter).toHaveBeenCalledWith(config);
    expect(adapter).toBeDefined();
  });

  it('creates MemoryAdapter for memory provider', () => {
    const config: StorageConfig = {
      provider: 'memory',
      bucket: 'test-bucket',
    };

    const adapter = createStorageAdapter(config);

    expect(MemoryAdapter).toHaveBeenCalled();
    expect(adapter).toBeDefined();
  });

  it('throws error for unsupported provider', () => {
    const config = {
      provider: 'unsupported',
      bucket: 'test-bucket',
    } as any;

    expect(() => createStorageAdapter(config)).toThrow(
      'Unsupported storage provider: unsupported',
    );
  });

  it('returns different adapter instances for different providers', () => {
    const s3Config: StorageConfig = {
      provider: 's3',
      bucket: 'test-bucket',
      region: 'us-east-1',
    };
    const minioConfig: StorageConfig = {
      provider: 'minio',
      bucket: 'test-bucket',
      endpoint: 'http://localhost:9000',
    };

    createStorageAdapter(s3Config);
    createStorageAdapter(minioConfig);

    expect(S3Adapter).toHaveBeenCalledWith(s3Config);
    expect(MinIOAdapter).toHaveBeenCalledWith(minioConfig);
  });

  it('throws error with descriptive message for null provider', () => {
    const config = {
      provider: null,
      bucket: 'test-bucket',
    } as any;

    expect(() => createStorageAdapter(config)).toThrow('Unsupported storage provider: null');
  });

  it('throws error for undefined provider', () => {
    const config = {
      provider: undefined,
      bucket: 'test-bucket',
    } as any;

    expect(() => createStorageAdapter(config)).toThrow('Unsupported storage provider: undefined');
  });

  it('handles config with all optional fields for S3', () => {
    const config: StorageConfig = {
      provider: 's3',
      bucket: 'videos',
      region: 'eu-west-1',
      endpoint: 'https://s3.example.com',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      encryptionMode: 'AES256',
      encryptionEnabled: true,
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 7200,
    };

    createStorageAdapter(config);

    expect(S3Adapter).toHaveBeenCalledWith(config);
  });

  it('handles config for MinIO with all fields', () => {
    const config: StorageConfig = {
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://minio:9000',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
      forcePathStyle: true,
      encryptionEnabled: false,
    };

    createStorageAdapter(config);

    expect(MinIOAdapter).toHaveBeenCalledWith(config);
  });

  it('exports S3Adapter class', () => {
    expect(S3Adapter).toBeDefined();
  });

  it('exports MinIOAdapter class', () => {
    expect(MinIOAdapter).toBeDefined();
  });

  it('exports MemoryAdapter class', () => {
    expect(MemoryAdapter).toBeDefined();
  });
});
