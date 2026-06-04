const mockBucketExists = jest.fn().mockResolvedValue(true);
const mockMakeBucket = jest.fn().mockResolvedValue(undefined);
const mockPresignedGetObject = jest.fn().mockResolvedValue('http://minio.local/download');
const mockRemoveObject = jest.fn().mockResolvedValue(undefined);
const mockStatObject = jest.fn().mockResolvedValue({});
const mockListObjectsV2 = jest.fn();
const mockPutObject = jest.fn().mockResolvedValue({ etag: 'temp-part-etag' });
const mockComposeObject = jest.fn().mockResolvedValue({});

const mockSend = jest.fn();

const mockCreateMultipartUploadCommand = jest.fn((input) => ({ input, command: 'CreateMultipartUploadCommand' }));
const mockUploadPartCommand = jest.fn((input) => ({ input, command: 'UploadPartCommand' }));
const mockCompleteMultipartUploadCommand = jest.fn((input) => ({ input, command: 'CompleteMultipartUploadCommand' }));
const mockListPartsCommand = jest.fn((input) => ({ input, command: 'ListPartsCommand' }));
const mockAbortMultipartUploadCommand = jest.fn((input) => ({ input, command: 'AbortMultipartUploadCommand' }));
const mockPutObjectCommand = jest.fn((input) => ({ input, command: 'PutObjectCommand' }));

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: mockBucketExists,
    makeBucket: mockMakeBucket,
    presignedGetObject: mockPresignedGetObject,
    removeObject: mockRemoveObject,
    statObject: mockStatObject,
    listObjectsV2: mockListObjectsV2,
    putObject: mockPutObject,
    composeObject: mockComposeObject,
  })),
  CopyDestinationOptions: jest.fn().mockImplementation((input) => input),
  CopySourceOptions: jest.fn().mockImplementation((input) => input),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  CreateMultipartUploadCommand: mockCreateMultipartUploadCommand,
  UploadPartCommand: mockUploadPartCommand,
  CompleteMultipartUploadCommand: mockCompleteMultipartUploadCommand,
  ListPartsCommand: mockListPartsCommand,
  AbortMultipartUploadCommand: mockAbortMultipartUploadCommand,
  PutObjectCommand: mockPutObjectCommand,
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('http://minio.local/upload'),
}));

import { MinIOAdapter } from '../MinIOAdapter';

describe('MinIOAdapter multipart compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'CreateMultipartUploadCommand') {
        return { UploadId: 'upload-id-123' };
      }

      if (command.command === 'UploadPartCommand') {
        return { ETag: '"etag-1"' };
      }

      if (command.command === 'ListPartsCommand') {
        return {
          Parts: [
            { PartNumber: 1, ETag: '"listed-etag-1"' },
            { PartNumber: 2, ETag: '"listed-etag-2"' },
          ],
          IsTruncated: false,
        };
      }

      if (command.command === 'AbortMultipartUploadCommand') {
        return {};
      }

      return {};
    });
  });

  it('omits multipart checksum headers for MinIO compatibility', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.initiateMultipartUpload('video.mp4', 'video/mp4');
    await adapter.uploadPart(Buffer.from('chunk'), 'video.mp4', 'upload-id-123', 1, 'checksum-base64');

    expect(mockCreateMultipartUploadCommand).toHaveBeenCalledWith(expect.not.objectContaining({
      ChecksumAlgorithm: expect.anything(),
    }));
    expect(mockUploadPartCommand).not.toHaveBeenCalled();
    expect(mockPutObject).toHaveBeenCalled();
  });

  it('composes temp chunk objects for server-side multipart uploads', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.initiateMultipartUpload('video.mp4', 'video/mp4');
    await adapter.uploadPart(Buffer.from('chunk-1'), 'video.mp4', 'upload-id-123', 1);
    await adapter.uploadPart(Buffer.from('chunk-2'), 'video.mp4', 'upload-id-123', 2);
    await adapter.completeMultipartUpload('video.mp4', 'upload-id-123', [
      { PartNumber: 2, ETag: 'ignored-2' },
      { PartNumber: 1, ETag: 'ignored-1' },
    ]);

    expect(mockComposeObject).toHaveBeenCalled();
    expect(mockCompleteMultipartUploadCommand).not.toHaveBeenCalled();
    expect(mockAbortMultipartUploadCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'videos',
      Key: 'video.mp4',
      UploadId: 'upload-id-123',
    }));
  });
});

describe('MinIOAdapter - getPublicUrl (browser-facing)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds an unsigned public URL using publicEndpoint, not the internal endpoint', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://minio:9000',
      publicEndpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      signedUrlTtlSeconds: 3600,
    });

    const url = await adapter.getPublicUrl('thumbnails/abc.jpg');

    expect(url).toBe('http://localhost:9000/videos/thumbnails/abc.jpg');
    // No signature, and never the internal docker host.
    expect(url).not.toContain('minio:9000');
    expect(url).not.toContain('X-Amz-Signature');
    expect(mockPresignedGetObject).not.toHaveBeenCalled();
  });

  it('falls back to the internal endpoint when publicEndpoint is absent', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000/',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
    });

    const url = await adapter.getPublicUrl('thumbnails/x y.jpg');

    expect(url).toBe('http://localhost:9000/videos/thumbnails/x%20y.jpg');
  });
});

describe('MinIOAdapter - getSignedUrl (generatePresignedUrl)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates presigned URL with default expiration time', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const url = await adapter.getSignedUrl('video.mp4');

    expect(url).toBe('http://minio.local/download');
    expect(mockPresignedGetObject).toHaveBeenCalledWith('videos', 'video.mp4', 3600);
  });

  it('generates presigned URL with custom expiration time', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 7200,
    });

    const url = await adapter.getSignedUrl('video.mp4', 1800);

    expect(url).toBe('http://minio.local/download');
    expect(mockPresignedGetObject).toHaveBeenCalledWith('videos', 'video.mp4', 1800);
  });

  it('handles presigned URL generation errors', async () => {
    mockPresignedGetObject.mockRejectedValue(new Error('Network error'));

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await expect(adapter.getSignedUrl('video.mp4')).rejects.toThrow('Network error');
  });
});

describe('MinIOAdapter - listObjects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBucketExists.mockResolvedValue(true);
  });

  it('lists objects without prefix filter', async () => {
    const mockStream = {
      on: jest.fn((event, handler) => {
        if (event === 'data') {
          handler({ name: 'video1.mp4', size: 1024, lastModified: new Date() });
          handler({ name: 'video2.mp4', size: 2048, lastModified: new Date() });
        } else if (event === 'end') {
          handler();
        }
      }),
    };

    mockListObjectsV2.mockReturnValue(mockStream);

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const objects = await adapter.listObjects();

    expect(objects).toHaveLength(2);
    expect(objects[0].key).toBe('video1.mp4');
    expect(objects[1].key).toBe('video2.mp4');
    expect(mockListObjectsV2).toHaveBeenCalledWith('videos', '', true);
  });

  it('lists objects with prefix filter', async () => {
    const mockStream = {
      on: jest.fn((event, handler) => {
        if (event === 'data') {
          handler({ name: 'uploads/video1.mp4', size: 1024, lastModified: new Date() });
        } else if (event === 'end') {
          handler();
        }
      }),
    };

    mockListObjectsV2.mockReturnValue(mockStream);

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const objects = await adapter.listObjects('uploads/');

    expect(objects).toHaveLength(1);
    expect(objects[0].key).toBe('uploads/video1.mp4');
    expect(mockListObjectsV2).toHaveBeenCalledWith('videos', 'uploads/', true);
  });

  it('filters out chunk files from listing', async () => {
    const mockStream = {
      on: jest.fn((event, handler) => {
        if (event === 'data') {
          handler({ name: 'video.mp4', size: 1024, lastModified: new Date() });
          handler({ name: 'video.mp4.__part__.upload-id.1', size: 512, lastModified: new Date() });
          handler({ name: 'temp.chunk.temp', size: 256, lastModified: new Date() });
        } else if (event === 'end') {
          handler();
        }
      }),
    };

    mockListObjectsV2.mockReturnValue(mockStream);

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const objects = await adapter.listObjects();

    expect(objects).toHaveLength(2);
    expect(objects[0].key).toBe('video.mp4');
    expect(objects[1].key).toBe('video.mp4.__part__.upload-id.1');
  });

  it('handles stream errors during listing', async () => {
    const mockStream = {
      on: jest.fn((event, handler) => {
        if (event === 'error') {
          handler(new Error('Stream error'));
        }
      }),
    };

    mockListObjectsV2.mockReturnValue(mockStream);

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await expect(adapter.listObjects()).rejects.toThrow('Stream error');
  });
});

describe('MinIOAdapter - delete (deleteFile)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRemoveObject.mockResolvedValue(undefined);
  });

  it('successfully deletes a file', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.delete('video.mp4');

    expect(mockRemoveObject).toHaveBeenCalledWith('videos', 'video.mp4');
  });

  it('handles deletion errors', async () => {
    mockRemoveObject.mockRejectedValue(new Error('File not found'));

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await expect(adapter.delete('nonexistent.mp4')).rejects.toThrow('File not found');
  });

  it('handles network errors during deletion', async () => {
    mockRemoveObject.mockRejectedValue(new Error('Connection timeout'));

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await expect(adapter.delete('video.mp4')).rejects.toThrow('Connection timeout');
  });
});

describe('MinIOAdapter - exists (checkBucketExists)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when file exists', async () => {
    mockStatObject.mockResolvedValue({ size: 1024, etag: 'etag123' });

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const exists = await adapter.exists('video.mp4');

    expect(exists).toBe(true);
    expect(mockStatObject).toHaveBeenCalledWith('videos', 'video.mp4');
  });

  it('returns false when file does not exist', async () => {
    mockStatObject.mockRejectedValue(new Error('Not found'));

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const exists = await adapter.exists('nonexistent.mp4');

    expect(exists).toBe(false);
  });

  it('returns false on network errors', async () => {
    mockStatObject.mockRejectedValue(new Error('Connection timeout'));

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const exists = await adapter.exists('video.mp4');

    expect(exists).toBe(false);
  });
});

describe('MinIOAdapter - error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBucketExists.mockResolvedValue(true);
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'PutObjectCommand') {
        return { ETag: 'etag' };
      }
      if (command.command === 'CreateMultipartUploadCommand') {
        return { UploadId: 'upload-id-123' };
      }
      return {};
    });
  });

  it('handles authentication errors during upload', async () => {
    mockSend.mockRejectedValue(new Error('Access denied'));

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'invalid',
      secretAccessKey: 'invalid',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await expect(adapter.upload(Buffer.from('data'), 'video.mp4', 'video/mp4')).rejects.toThrow(
      'Access denied',
    );
  });

  it('handles network errors during bucket creation', async () => {
    mockBucketExists.mockRejectedValue(new Error('Network error'));

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await expect(adapter.ensureBucket()).rejects.toThrow('Network error');
  });

  it('creates bucket if it does not exist', async () => {
    mockBucketExists.mockResolvedValue(false);
    mockMakeBucket.mockResolvedValue(undefined);

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.ensureBucket();

    expect(mockBucketExists).toHaveBeenCalledWith('videos');
    expect(mockMakeBucket).toHaveBeenCalledWith('videos');
  });

  it('does not recreate bucket if it already exists', async () => {
    mockBucketExists.mockResolvedValue(true);

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.ensureBucket();

    expect(mockBucketExists).toHaveBeenCalledWith('videos');
    expect(mockMakeBucket).not.toHaveBeenCalled();
  });

  it('handles errors during bucket creation', async () => {
    mockBucketExists.mockResolvedValue(false);
    mockMakeBucket.mockRejectedValue(new Error('Permission denied'));

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await expect(adapter.ensureBucket()).rejects.toThrow('Permission denied');
  });
});

describe('MinIOAdapter - getUploadPresignedUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBucketExists.mockResolvedValue(true);
  });

  it('generates upload presigned URL with default TTL', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const url = await adapter.getUploadPresignedUrl('video.mp4', 'video/mp4');

    expect(url).toBe('http://minio.local/upload');
    expect(mockBucketExists).toHaveBeenCalledWith('videos');
  });

  it('generates upload presigned URL with custom TTL', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 7200,
    });

    const url = await adapter.getUploadPresignedUrl('video.mp4', 'video/mp4', 1800);

    expect(url).toBe('http://minio.local/upload');
  });

  it('handles errors during upload presigned URL generation', async () => {
    mockBucketExists.mockRejectedValue(new Error('Network error'));

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await expect(adapter.getUploadPresignedUrl('video.mp4', 'video/mp4')).rejects.toThrow(
      'Network error',
    );
  });
});

describe('MinIOAdapter - getUploadPartPresignedUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates upload part presigned URL with default TTL', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const url = await adapter.getUploadPartPresignedUrl('video.mp4', 'upload-id-123', 1);

    expect(url).toBe('http://minio.local/upload');
  });

  it('generates upload part presigned URL with custom TTL', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 7200,
    });

    const url = await adapter.getUploadPartPresignedUrl('video.mp4', 'upload-id-123', 1, 1800);

    expect(url).toBe('http://minio.local/upload');
  });
});

describe('MinIOAdapter - uploadPart with S3 API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBucketExists.mockResolvedValue(true);
  });

  it('uploads part via S3 API when not in compose session', async () => {
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'UploadPartCommand') {
        return { ETag: '"etag-part-123"' };
      }
      return {};
    });

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const etag = await adapter.uploadPart(Buffer.from('part-data'), 'video.mp4', 'unknown-upload-id', 1);

    expect(etag).toBe('etag-part-123');
    expect(mockUploadPartCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'videos',
      Key: 'video.mp4',
      UploadId: 'unknown-upload-id',
      PartNumber: 1,
    }));
  });

  it('strips quotes from ETag when uploading part', async () => {
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'UploadPartCommand') {
        return { ETag: '"etag-with-quotes"' };
      }
      return {};
    });

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const etag = await adapter.uploadPart(Buffer.from('part-data'), 'video.mp4', 'upload-id-999', 1);

    expect(etag).toBe('etag-with-quotes');
  });

  it('returns empty string when ETag is missing', async () => {
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'UploadPartCommand') {
        return {};
      }
      return {};
    });

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const etag = await adapter.uploadPart(Buffer.from('part-data'), 'video.mp4', 'upload-id-999', 1);

    expect(etag).toBe('');
  });
});

describe('MinIOAdapter - upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBucketExists.mockResolvedValue(true);
    mockPresignedGetObject.mockResolvedValue('http://minio.local/presigned');
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'PutObjectCommand') {
        return { ETag: 'etag-123' };
      }
      return {};
    });
  });

  it('uploads file and returns presigned URL', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const url = await adapter.upload(Buffer.from('test data'), 'video.mp4', 'video/mp4');

    expect(url).toBe('http://minio.local/presigned');
    expect(mockPutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'videos',
      Key: 'video.mp4',
      ContentType: 'video/mp4',
    }));
  });

  it('includes checksum SHA256 in upload when provided', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.upload(Buffer.from('test data'), 'video.mp4', 'video/mp4', 'sha256-hash');

    expect(mockPutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
      ChecksumSHA256: 'sha256-hash',
    }));
  });

  it('omits checksum SHA256 when not provided', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.upload(Buffer.from('test data'), 'video.mp4', 'video/mp4');

    const callArgs = mockPutObjectCommand.mock.calls[0][0];
    expect(callArgs.ChecksumSHA256).toBeUndefined();
  });
});

describe('MinIOAdapter - encryption handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBucketExists.mockResolvedValue(true);
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'CreateMultipartUploadCommand') {
        return { UploadId: 'upload-id-123' };
      }
      return {};
    });
  });

  it('includes encryption headers in multipart initiation', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.initiateMultipartUpload('video.mp4', 'video/mp4');

    expect(mockCreateMultipartUploadCommand).toHaveBeenCalledWith(expect.objectContaining({
      ServerSideEncryption: 'AES256',
    }));
  });

  it('omits encryption headers when encryption is disabled', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.initiateMultipartUpload('video.mp4', 'video/mp4');

    expect(mockCreateMultipartUploadCommand).toHaveBeenCalledWith(expect.not.objectContaining({
      ServerSideEncryption: expect.anything(),
    }));
  });
});

describe('MinIOAdapter - complete multipart upload with S3', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'ListPartsCommand') {
        return {
          Parts: [
            { PartNumber: 1, ETag: '"listed-etag-1"' },
            { PartNumber: 2, ETag: '"listed-etag-2"' },
          ],
          IsTruncated: false,
        };
      }

      if (command.command === 'CompleteMultipartUploadCommand') {
        return { ETag: 'composite-etag' };
      }

      return {};
    });
    mockPresignedGetObject.mockResolvedValue('http://minio.local/download');
  });

  it('completes multipart upload using S3 API', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const url = await adapter.completeMultipartUpload('video.mp4', 'upload-id-123', [
      { PartNumber: 1, ETag: 'etag-1' },
      { PartNumber: 2, ETag: 'etag-2' },
    ]);

    expect(url).toBe('http://minio.local/download');
    expect(mockCompleteMultipartUploadCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'videos',
      Key: 'video.mp4',
      UploadId: 'upload-id-123',
    }));
  });

  it('normalizes ETags without quotes during completion', async () => {
    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.completeMultipartUpload('video.mp4', 'upload-id-123', [
      { PartNumber: 1, ETag: 'etag-1' },
      { PartNumber: 2, ETag: '"etag-2"' },
    ]);

    const callArgs = mockCompleteMultipartUploadCommand.mock.calls[0][0];
    const parts = callArgs.MultipartUpload?.Parts || [];
    expect(parts[0].ETag).toBe('"listed-etag-1"');
    expect(parts[1].ETag).toBe('"listed-etag-2"');
  });

  it('handles errors during S3 multipart completion with graceful abort', async () => {
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'ListPartsCommand') {
        return {
          Parts: [
            { PartNumber: 1, ETag: '"listed-etag-1"' },
          ],
          IsTruncated: false,
        };
      }

      if (command.command === 'CompleteMultipartUploadCommand') {
        throw new Error('S3 error');
      }

      return {};
    });

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await expect(
      adapter.completeMultipartUpload('video.mp4', 'upload-id-123', [
        { PartNumber: 1, ETag: 'etag-1' },
      ]),
    ).rejects.toThrow('S3 error');
  });

  it('handles paginated part listing in multipart completion', async () => {
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'ListPartsCommand') {
        // First page
        if (!command.input.PartNumberMarker) {
          return {
            Parts: [
              { PartNumber: 1, ETag: '"etag-1"' },
              { PartNumber: 2, ETag: '"etag-2"' },
            ],
            IsTruncated: true,
            NextPartNumberMarker: '2',
          };
        }
        // Second page
        return {
          Parts: [
            { PartNumber: 3, ETag: '"etag-3"' },
          ],
          IsTruncated: false,
        };
      }

      if (command.command === 'CompleteMultipartUploadCommand') {
        return { ETag: 'composite-etag' };
      }

      return {};
    });

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const url = await adapter.completeMultipartUpload('video.mp4', 'upload-id-123', []);

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(url).toBe('http://minio.local/download');
  });

  it('gracefully handles abort errors in multipart completion for composed uploads', async () => {
    mockBucketExists.mockResolvedValue(true);
    const mockStream = {
      on: jest.fn((event, handler) => {
        if (event === 'end') {
          handler();
        }
      }),
    };

    mockListObjectsV2.mockReturnValue(mockStream);
    mockComposeObject.mockResolvedValue(undefined);
    mockRemoveObject.mockResolvedValue(undefined);

    let callCount = 0;
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'CreateMultipartUploadCommand') {
        return { UploadId: 'upload-id-123' };
      }
      if (command.command === 'AbortMultipartUploadCommand') {
        callCount++;
        if (callCount === 1) {
          throw new Error('Abort failed');
        }
      }
      return {};
    });

    const adapter = new MinIOAdapter({
      provider: 'minio',
      bucket: 'videos',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'admin',
      secretAccessKey: 'password123',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.initiateMultipartUpload('video.mp4', 'video/mp4');
    await adapter.uploadPart(Buffer.from('chunk-1'), 'video.mp4', 'upload-id-123', 1);
    await adapter.uploadPart(Buffer.from('chunk-2'), 'video.mp4', 'upload-id-123', 2);

    mockPresignedGetObject.mockResolvedValue('http://minio.local/download');

    const url = await adapter.completeMultipartUpload('video.mp4', 'upload-id-123', []);

    expect(url).toBe('http://minio.local/download');
    expect(mockAbortMultipartUploadCommand).toHaveBeenCalled();
  });
});
