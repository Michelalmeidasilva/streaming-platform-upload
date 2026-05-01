const mockSend = jest.fn().mockResolvedValue({ UploadId: 'upload-id-123', ETag: '"etag-abc"' });
const mockGetSignedUrl = jest.fn().mockResolvedValue('https://signed.example/upload');

const mockPutObjectCommand = jest.fn((input) => ({ input, command: 'PutObjectCommand' }));
const mockCreateMultipartUploadCommand = jest.fn((input) => ({ input, command: 'CreateMultipartUploadCommand' }));
const mockUploadPartCommand = jest.fn((input) => ({ input, command: 'UploadPartCommand' }));
const mockCompleteMultipartUploadCommand = jest.fn((input) => ({ input, command: 'CompleteMultipartUploadCommand' }));
const mockListPartsCommand = jest.fn((input) => ({ input, command: 'ListPartsCommand' }));
const mockDeleteObjectCommand = jest.fn((input) => ({ input, command: 'DeleteObjectCommand' }));
const mockGetObjectCommand = jest.fn((input) => ({ input, command: 'GetObjectCommand' }));
const mockListObjectsV2Command = jest.fn((input) => ({ input, command: 'ListObjectsV2Command' }));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: mockPutObjectCommand,
  DeleteObjectCommand: mockDeleteObjectCommand,
  GetObjectCommand: mockGetObjectCommand,
  CreateMultipartUploadCommand: mockCreateMultipartUploadCommand,
  UploadPartCommand: mockUploadPartCommand,
  CompleteMultipartUploadCommand: mockCompleteMultipartUploadCommand,
  ListPartsCommand: mockListPartsCommand,
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
      if (command.command === 'ListPartsCommand') {
        return {
          Parts: [
            { PartNumber: 1, ETag: '"listed-etag-1"' },
            { PartNumber: 2, ETag: '"listed-etag-2"' },
          ],
          IsTruncated: false,
        };
      }

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

  it('applies the same policy when starting multipart uploads and chunk uploads', async () => {
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
      ChecksumAlgorithm: 'SHA256',
    }));
    expect(mockUploadPartCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'videos',
      Key: 'video.mp4',
      UploadId: 'upload-id-123',
      PartNumber: 1,
      ChecksumSHA256: 'chunk-checksum',
    }));
  });

  it('uses storage-listed multipart etags before completion', async () => {
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
          { PartNumber: 1, ETag: '"listed-etag-1"' },
          { PartNumber: 2, ETag: '"listed-etag-2"' },
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
});
