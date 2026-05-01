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
