const mockSend = jest.fn().mockResolvedValue({ UploadId: 'upload-id-123', ETag: '"etag-abc"' });
const mockGetSignedUrl = jest.fn().mockResolvedValue('https://signed.example/upload');

const mockPutObjectCommand = jest.fn((input) => ({ input, command: 'PutObjectCommand' }));
const mockCreateMultipartUploadCommand = jest.fn((input) => ({ input, command: 'CreateMultipartUploadCommand' }));
const mockUploadPartCommand = jest.fn((input) => ({ input, command: 'UploadPartCommand' }));
const mockCompleteMultipartUploadCommand = jest.fn((input) => ({ input, command: 'CompleteMultipartUploadCommand' }));
const mockDeleteObjectCommand = jest.fn((input) => ({ input, command: 'DeleteObjectCommand' }));
const mockGetObjectCommand = jest.fn((input) => ({ input, command: 'GetObjectCommand' }));
const mockHeadObjectCommand = jest.fn((input) => ({ input, command: 'HeadObjectCommand' }));
const mockListObjectsV2Command = jest.fn((input) => ({ input, command: 'ListObjectsV2Command' }));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: mockPutObjectCommand,
  DeleteObjectCommand: mockDeleteObjectCommand,
  GetObjectCommand: mockGetObjectCommand,
  HeadObjectCommand: mockHeadObjectCommand,
  CreateMultipartUploadCommand: mockCreateMultipartUploadCommand,
  UploadPartCommand: mockUploadPartCommand,
  CompleteMultipartUploadCommand: mockCompleteMultipartUploadCommand,
  ListObjectsV2Command: mockListObjectsV2Command,
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import { S3Adapter } from '../S3Adapter';

describe('S3Adapter security behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockImplementation(async (command) => {
      if (command.command === 'CreateMultipartUploadCommand') {
        return { UploadId: 'upload-id-123' };
      }

      if (command.command === 'UploadPartCommand') {
        return { ETag: '"etag-abc"' };
      }

      return {};
    });
  });

  it('applies server-side encryption and checksum policy to uploads', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.upload(Buffer.from('video'), 'video.mp4', 'video/mp4', 'checksum-base64');

    expect(mockPutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'videos',
      Key: 'video.mp4',
      ContentType: 'video/mp4',
      ServerSideEncryption: 'AES256',
      ChecksumAlgorithm: 'SHA256',
      ChecksumSHA256: 'checksum-base64',
    }));
  });

  it('applies encryption on multipart initiation and checksum on server-side chunk uploads', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.initiateMultipartUpload('video.mp4', 'video/mp4');
    await adapter.uploadPart(Buffer.from('chunk'), 'video.mp4', 'upload-id-123', 1, 'chunk-checksum');

    expect(mockCreateMultipartUploadCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'videos',
      Key: 'video.mp4',
      ContentType: 'video/mp4',
      ServerSideEncryption: 'AES256',
    }));
    expect(mockUploadPartCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'videos',
      Key: 'video.mp4',
      UploadId: 'upload-id-123',
      PartNumber: 1,
      ChecksumSHA256: 'chunk-checksum',
    }));
  });

  it('uses provided etags to complete multipart upload, sorted and normalized', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.completeMultipartUpload('video.mp4', 'upload-id-123', [
      { PartNumber: 2, ETag: 'etag-2' },
      { PartNumber: 1, ETag: '"etag-1"' },
    ]);

    expect(mockCompleteMultipartUploadCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'videos',
      Key: 'video.mp4',
      UploadId: 'upload-id-123',
      MultipartUpload: {
        Parts: [
          { PartNumber: 1, ETag: '"etag-1"' },
          { PartNumber: 2, ETag: '"etag-2"' },
        ],
      },
    }));
  });

  it('skips the SSE header when encryption is temporarily disabled', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: false,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.upload(Buffer.from('video'), 'video.mp4', 'video/mp4', 'checksum-base64');
    await adapter.initiateMultipartUpload('video.mp4', 'video/mp4');

    expect(mockPutObjectCommand).toHaveBeenCalledWith(expect.not.objectContaining({
      ServerSideEncryption: expect.anything(),
    }));
    expect(mockCreateMultipartUploadCommand).toHaveBeenCalledWith(expect.not.objectContaining({
      ServerSideEncryption: expect.anything(),
    }));
  });

  it('generates presigned URL with custom expiration time', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockGetSignedUrl.mockResolvedValueOnce('https://signed.example/custom-expiration');
    const url = await adapter.getUploadPresignedUrl('video.mp4', 'video/mp4', 7200);

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 7200 },
    );
    expect(url).toBe('https://signed.example/custom-expiration');
  });

  it('generates presigned URL with default expiration from policy', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 1800,
    });

    mockGetSignedUrl.mockResolvedValueOnce('https://signed.example/default-ttl');
    const url = await adapter.getUploadPresignedUrl('large-video.mp4', 'video/mp4');

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 1800 },
    );
    expect(url).toBe('https://signed.example/default-ttl');
  });

  it('generates presigned URL for multipart upload parts with custom expiration', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockGetSignedUrl.mockResolvedValueOnce('https://signed.example/part-upload');
    const url = await adapter.getUploadPartPresignedUrl('video.mp4', 'upload-id-123', 1, 5400);

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 5400 },
    );
    expect(url).toBe('https://signed.example/part-upload');
  });

  it('generates presigned URL for multipart upload parts with default expiration', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockGetSignedUrl.mockResolvedValueOnce('https://signed.example/part-default');
    const url = await adapter.getUploadPartPresignedUrl('video.mp4', 'upload-id-123', 1);

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 3600 },
    );
    expect(url).toBe('https://signed.example/part-default');
  });

  it('generates signed download URL with custom expiration', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockGetSignedUrl.mockResolvedValueOnce('https://signed.example/download-custom');
    const url = await adapter.getSignedUrl('video.mp4', 7200);

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 7200 },
    );
    expect(url).toBe('https://signed.example/download-custom');
  });

  it('generates signed download URL with default expiration from policy', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 1800,
    });

    mockGetSignedUrl.mockResolvedValueOnce('https://signed.example/download-default');
    const url = await adapter.getSignedUrl('video.mp4');

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 1800 },
    );
    expect(url).toBe('https://signed.example/download-default');
  });

  it('deletes a file from storage', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockResolvedValueOnce({});

    await adapter.delete('video.mp4');

    expect(mockDeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'videos',
      Key: 'video.mp4',
    });
  });

  it('handles delete errors gracefully', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const deleteError = new Error('Access Denied');
    mockSend.mockRejectedValueOnce(deleteError);

    await expect(adapter.delete('video.mp4')).rejects.toThrow('Access Denied');
  });

  it('checks if a file exists in storage', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockResolvedValueOnce({ ContentLength: 1024 });

    const exists = await adapter.exists('video.mp4');

    expect(exists).toBe(true);
    expect(mockHeadObjectCommand).toHaveBeenCalledWith({
      Bucket: 'videos',
      Key: 'video.mp4',
    });
  });

  it('returns false when file does not exist', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockRejectedValueOnce(new Error('NoSuchKey'));

    const exists = await adapter.exists('nonexistent.mp4');

    expect(exists).toBe(false);
  });

  it('lists all objects in bucket', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const now = new Date();
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'video1.mp4', Size: 1024000, LastModified: now },
        { Key: 'video2.mp4', Size: 2048000, LastModified: now },
        { Key: 'subdir/video3.mp4', Size: 512000, LastModified: now },
      ],
    });

    const objects = await adapter.listObjects();

    expect(mockListObjectsV2Command).toHaveBeenCalledWith({
      Bucket: 'videos',
      Prefix: '',
    });
    expect(objects).toHaveLength(3);
    expect(objects[0]).toEqual({ key: 'video1.mp4', size: 1024000, lastModified: now });
  });

  it('lists objects with prefix filter', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const now = new Date();
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'uploads/video1.mp4', Size: 1024000, LastModified: now },
        { Key: 'uploads/video2.mp4', Size: 2048000, LastModified: now },
      ],
    });

    const objects = await adapter.listObjects('uploads/');

    expect(mockListObjectsV2Command).toHaveBeenCalledWith({
      Bucket: 'videos',
      Prefix: 'uploads/',
    });
    expect(objects).toHaveLength(2);
  });

  it('filters out chunk files from listing', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const now = new Date();
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'video1.mp4', Size: 1024000, LastModified: now },
        { Key: 'video1.mp4.chunk.1', Size: 10485760, LastModified: now },
        { Key: 'video1.mp4.chunk.2', Size: 10485760, LastModified: now },
        { Key: 'video2.mp4', Size: 512000, LastModified: now },
      ],
    });

    const objects = await adapter.listObjects();

    expect(objects).toHaveLength(2);
    expect(objects.map(o => o.key)).toEqual(['video1.mp4', 'video2.mp4']);
  });

  it('handles empty listing', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockResolvedValueOnce({});

    const objects = await adapter.listObjects();

    expect(objects).toHaveLength(0);
  });

  it('handles listing errors', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockRejectedValueOnce(new Error('Bucket does not exist'));

    await expect(adapter.listObjects()).rejects.toThrow('Bucket does not exist');
  });

  it('handles upload errors with encryption policy', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockRejectedValueOnce(new Error('InvalidBucketName'));

    await expect(adapter.upload(Buffer.from('data'), 'video.mp4', 'video/mp4')).rejects.toThrow('InvalidBucketName');
  });

  it('handles multipart initiation errors', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockRejectedValueOnce(new Error('NoSuchBucket'));

    await expect(adapter.initiateMultipartUpload('video.mp4', 'video/mp4')).rejects.toThrow('NoSuchBucket');
  });

  it('handles part upload errors', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockRejectedValueOnce(new Error('InvalidPartOrder'));

    await expect(
      adapter.uploadPart(Buffer.from('chunk'), 'video.mp4', 'upload-id-123', 1)
    ).rejects.toThrow('InvalidPartOrder');
  });

  it('handles multipart completion errors', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockRejectedValueOnce(new Error('EntityTooSmall'));

    await expect(
      adapter.completeMultipartUpload('video.mp4', 'upload-id-123', [])
    ).rejects.toThrow('EntityTooSmall');
  });

  it('handles presigned URL generation errors', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockGetSignedUrl.mockRejectedValueOnce(new Error('InvalidCredentials'));

    await expect(adapter.getUploadPresignedUrl('video.mp4', 'video/mp4')).rejects.toThrow('InvalidCredentials');
  });

  it('removes quotes from ETag in uploadPart response', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockResolvedValueOnce({ ETag: '"etag-with-quotes"' });

    const etag = await adapter.uploadPart(Buffer.from('chunk'), 'video.mp4', 'upload-id-123', 1);

    expect(etag).toBe('etag-with-quotes');
  });

  it('handles uploadPart with checksum parameter', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockResolvedValueOnce({ ETag: '"etag-123"' });

    await adapter.uploadPart(Buffer.from('chunk'), 'video.mp4', 'upload-id-123', 1, 'part-checksum');

    expect(mockUploadPartCommand).toHaveBeenCalledWith(expect.objectContaining({
      ChecksumSHA256: 'part-checksum',
    }));
  });

  it('handles uploadPart without checksum parameter', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockResolvedValueOnce({ ETag: '"etag-456"' });

    await adapter.uploadPart(Buffer.from('chunk'), 'video.mp4', 'upload-id-123', 1);

    expect(mockUploadPartCommand).toHaveBeenCalledWith(expect.objectContaining({
      ChecksumAlgorithm: 'SHA256',
    }));
  });

  it('returns empty string when initiateMultipartUpload receives no UploadId', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockResolvedValueOnce({});

    const uploadId = await adapter.initiateMultipartUpload('video.mp4', 'video/mp4');

    expect(uploadId).toBe('');
  });

  it('completes multipart upload with provided parts sorted by PartNumber', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.completeMultipartUpload('video.mp4', 'upload-id-123', [
      { PartNumber: 4, ETag: '"etag-4"' },
      { PartNumber: 2, ETag: '"etag-2"' },
      { PartNumber: 1, ETag: '"etag-1"' },
      { PartNumber: 3, ETag: '"etag-3"' },
    ]);

    expect(mockCompleteMultipartUploadCommand).toHaveBeenCalledWith(expect.objectContaining({
      MultipartUpload: {
        Parts: [
          { PartNumber: 1, ETag: '"etag-1"' },
          { PartNumber: 2, ETag: '"etag-2"' },
          { PartNumber: 3, ETag: '"etag-3"' },
          { PartNumber: 4, ETag: '"etag-4"' },
        ],
      },
    }));
  });

  it('completes multipart upload with provided parts directly (no extra ListParts call)', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.completeMultipartUpload('video.mp4', 'upload-id-123', [
      { PartNumber: 1, ETag: 'etag-1' },
      { PartNumber: 2, ETag: 'etag-2' },
    ]);

    expect(mockCompleteMultipartUploadCommand).toHaveBeenCalledTimes(1);
    expect(mockCompleteMultipartUploadCommand).toHaveBeenCalledWith(expect.objectContaining({
      MultipartUpload: {
        Parts: [
          { PartNumber: 1, ETag: '"etag-1"' },
          { PartNumber: 2, ETag: '"etag-2"' },
        ],
      },
    }));
  });

  it('handles constructor with credentials in config', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      region: 'us-west-2',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockResolvedValueOnce({});

    await adapter.upload(Buffer.from('data'), 'test.mp4', 'video/mp4');

    expect(mockPutObjectCommand).toHaveBeenCalled();
  });

  it('handles constructor without credentials in config', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockResolvedValueOnce({});

    await adapter.upload(Buffer.from('data'), 'test.mp4', 'video/mp4');

    expect(mockPutObjectCommand).toHaveBeenCalled();
  });

  it('normalizes ETag format in completeMultipartUpload', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.completeMultipartUpload('video.mp4', 'upload-id-123', [
      { PartNumber: 1, ETag: 'etag-without-quotes' },
      { PartNumber: 2, ETag: '"etag-with-quotes"' },
    ]);

    expect(mockCompleteMultipartUploadCommand).toHaveBeenCalledWith(expect.objectContaining({
      MultipartUpload: {
        Parts: [
          { PartNumber: 1, ETag: '"etag-without-quotes"' },
          { PartNumber: 2, ETag: '"etag-with-quotes"' },
        ],
      },
    }));
  });

  it('handles storage object with missing LastModified', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'video1.mp4', Size: 1024000 },
        { Key: 'video2.mp4', Size: 2048000, LastModified: new Date() },
      ],
    });

    const objects = await adapter.listObjects();

    expect(objects).toHaveLength(2);
    expect(objects[0].lastModified).toBeInstanceOf(Date);
    expect(objects[1].lastModified).toBeInstanceOf(Date);
  });

  it('handles storage object with missing Size', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    const now = new Date();
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'video1.mp4', LastModified: now },
        { Key: 'video2.mp4', Size: 2048000, LastModified: now },
      ],
    });

    const objects = await adapter.listObjects();

    expect(objects).toHaveLength(2);
    expect(objects[0].size).toBe(0);
    expect(objects[1].size).toBe(2048000);
  });

  it('completes multipart upload with a single provided part', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.completeMultipartUpload('video.mp4', 'upload-id-123', [
      { PartNumber: 1, ETag: 'etag-1' },
    ]);

    expect(mockCompleteMultipartUploadCommand).toHaveBeenCalledWith(expect.objectContaining({
      MultipartUpload: {
        Parts: [
          { PartNumber: 1, ETag: '"etag-1"' },
        ],
      },
    }));
  });

  it('completes multipart upload with empty parts list', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
      encryptionEnabled: true,
      encryptionMode: 'AES256',
      checksumAlgorithm: 'SHA256',
      signedUrlTtlSeconds: 3600,
    });

    await adapter.completeMultipartUpload('video.mp4', 'upload-id-123', []);

    expect(mockCompleteMultipartUploadCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'videos',
      Key: 'video.mp4',
      UploadId: 'upload-id-123',
      MultipartUpload: { Parts: [] },
    }));
  });

  it('returns empty string when uploadPart receives no ETag', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
    });

    mockSend.mockResolvedValueOnce({});

    const etag = await adapter.uploadPart(Buffer.from('chunk'), 'video.mp4', 'upload-id-123', 1);

    expect(etag).toBe('');
  });

  it('filters out objects with missing Keys in listObjects', async () => {
    const adapter = new S3Adapter({
      provider: 's3',
      bucket: 'videos',
    });

    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'valid.mp4', Size: 100 },
        { Size: 200 }, // Missing Key
      ],
    });

    const objects = await adapter.listObjects();
    expect(objects).toHaveLength(1);
    expect(objects[0].key).toBe('valid.mp4');
  });
});
