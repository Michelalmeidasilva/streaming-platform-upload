/* eslint-disable @typescript-eslint/no-explicit-any */
import { uploadService, storageAdapter } from '../uploadService';

jest.mock('@/lib/storage', () => ({
  createStorageAdapter: jest.fn(() => ({
    putObject: jest.fn(),
    getSignedUrl: jest.fn(),
  })),
}));

jest.mock('@/lib/services/UploadService', () => ({
  UploadService: jest.fn(function (adapter, options) {
    this.adapter = adapter;
    this.options = options;
  }),
}));

jest.mock('@/lib/events/EventDispatcher', () => ({
  initializeEventDispatcher: jest.fn(),
}));

jest.mock('@/lib/security/recovery-policy', () => ({
  getRecoveryPolicy: jest.fn(() => ({
    maxRetries: 3,
    retryDelayMs: 1000,
  })),
}));

jest.mock('@/lib/security/storage-policy', () => ({
  resolveStoragePolicy: jest.fn((config) => ({
    encryptionEnabled: config.encryptionEnabled,
    encryptionMode: config.encryptionMode,
  })),
}));

describe('uploadService', () => {
  const originalEnv = process.env;

  const loadFreshModule = async (
    env: Record<string, string | undefined>,
    options?: { resetSingleton?: boolean }
  ) => {
    jest.resetModules();
    if (options?.resetSingleton !== false) {
      delete (globalThis as any).__uploadServiceSingleton__;
    }
    process.env = { ...originalEnv, ...env };
    const mod = await import('../uploadService');
    const storageModule = await import('@/lib/storage');
    const storagePolicyModule = await import('@/lib/security/storage-policy');
    return { mod, storageModule, storagePolicyModule };
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete (globalThis as any).__uploadServiceSingleton__;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
    delete (globalThis as any).__uploadServiceSingleton__;
  });

  it('provides uploadService singleton', () => {
    expect(uploadService).toBeDefined();
  });

  it('provides storageAdapter singleton', () => {
    expect(storageAdapter).toBeDefined();
  });

  it('uploadService and storageAdapter are singletons', () => {
    expect(uploadService).toBeDefined();
    expect(storageAdapter).toBeDefined();
  });

  it('uploads are initialized with proper mocks', () => {
    expect(uploadService).toBeTruthy();
    expect(storageAdapter).toBeTruthy();
  });

  it('builds an s3 storage config from env vars', async () => {
    const { storageModule, storagePolicyModule } = await loadFreshModule({
      STORAGE_PROVIDER: 's3',
      STORAGE_BUCKET: 'vod',
      AWS_REGION: 'sa-east-1',
      S3_ENDPOINT: 'https://s3.example.com',
      AWS_ACCESS_KEY_ID: 'key',
      AWS_SECRET_ACCESS_KEY: 'secret',
      S3_FORCE_PATH_STYLE: 'true',
      STORAGE_SIGNED_URL_TTL_SECONDS: '120',
    });

    expect(storageModule.createStorageAdapter).toHaveBeenCalledWith(expect.objectContaining({
      provider: 's3',
      bucket: 'vod',
      region: 'sa-east-1',
      endpoint: 'https://s3.example.com',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      forcePathStyle: true,
    }));
    expect(storagePolicyModule.resolveStoragePolicy).toHaveBeenCalledWith(expect.objectContaining({
      signedUrlTtlSeconds: 120,
    }));
  });

  it('builds a minio storage config by default', async () => {
    const { storageModule } = await loadFreshModule({
      STORAGE_PROVIDER: 'minio',
      STORAGE_BUCKET: 'videos-test',
      MINIO_ENDPOINT: 'http://minio.example:9000',
      MINIO_ACCESS_KEY: 'minio-user',
      MINIO_SECRET_KEY: 'minio-pass',
    });

    expect(storageModule.createStorageAdapter).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'minio',
      bucket: 'videos-test',
      endpoint: 'http://minio.example:9000',
      accessKeyId: 'minio-user',
      secretAccessKey: 'minio-pass',
      forcePathStyle: true,
    }));
  });

  it('builds a memory storage config for non-s3 and non-minio providers', async () => {
    const { storageModule, storagePolicyModule } = await loadFreshModule({
      STORAGE_PROVIDER: 'memory',
      STORAGE_BUCKET: 'memory-bucket',
      STORAGE_SIGNED_URL_TTL_SECONDS: 'not-a-number',
    });

    expect(storageModule.createStorageAdapter).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'memory',
      bucket: 'memory-bucket',
    }));
    expect(storagePolicyModule.resolveStoragePolicy).toHaveBeenCalledWith(expect.objectContaining({
      signedUrlTtlSeconds: undefined,
    }));
  });

  it('reuses an existing singleton without recreating the adapter', async () => {
    (globalThis as any).__uploadServiceSingleton__ = {
      uploadService: { existing: true },
      storageAdapter: { existing: true },
    };

    const { mod, storageModule } = await loadFreshModule({}, { resetSingleton: false });

    expect(mod.uploadService).toEqual({ existing: true });
    expect(mod.storageAdapter).toEqual({ existing: true });
    expect(storageModule.createStorageAdapter).not.toHaveBeenCalled();
  });
});
