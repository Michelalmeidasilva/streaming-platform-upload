import { createHash } from 'crypto';
import { UploadService } from '@/lib/services/UploadService';
import { IStorageAdapter } from '@/lib/storage/IStorageAdapter';

jest.mock('@/lib/services/ThumbnailExtractor', () => ({
  ThumbnailExtractor: jest.fn().mockImplementation(() => ({
    extract: jest.fn(),
  })),
}));

function makeStorage(): jest.Mocked<IStorageAdapter> {
  return {
    upload: jest.fn().mockResolvedValue('https://storage.example/object'),
    getUploadPresignedUrl: jest.fn().mockResolvedValue('https://storage.example/presigned-put'),
    initiateMultipartUpload: jest.fn().mockResolvedValue('upload-id-123'),
    uploadPart: jest.fn().mockResolvedValue('"etag-abc"'),
    getUploadPartPresignedUrl: jest.fn().mockResolvedValue('https://storage.example/presigned-part'),
    completeMultipartUpload: jest.fn().mockResolvedValue('https://storage.example/object'),
    delete: jest.fn().mockResolvedValue(undefined),
    getSignedUrl: jest.fn().mockResolvedValue('https://storage.example/object'),
    exists: jest.fn().mockResolvedValue(false),
    listObjects: jest.fn().mockResolvedValue([]),
  };
}

describe('upload security metadata', () => {
  it('carries the storage and recovery posture onto created videos', async () => {
    const storage = makeStorage();
    const service = new UploadService(storage);
    const { videoId } = await service.initiateUpload('video.mp4', 2 * 1024 * 1024, 'video/mp4');

    const video = service.getVideo(videoId);
    expect(video?.securityPosture).toEqual({
      storage: {
        encryptionEnabled: true,
        encryptionMode: 'AES256',
        checksumAlgorithm: 'SHA256',
        signedUrlTtlSeconds: 3600,
      },
      recovery: {
        versioning: 'required',
        backupTarget: 'required',
        replicationTarget: 'required',
        accidentalDeletionRecovery: 'versioning-plus-backup',
        regionalLossRecovery: 'replication-plus-backup',
      },
    });
  });

  it('passes checksum-aware chunks through the storage adapter', async () => {
    const storage = makeStorage();
    const service = new UploadService(storage);
    const { sessionId } = await service.initiateUpload('video.mp4', 25 * 1024 * 1024, 'video/mp4');
    const chunk = Buffer.from('chunk-one');
    const checksum = createHash('sha256').update(chunk).digest('base64');

    await service.uploadChunk(sessionId, 0, chunk);

    expect(storage.uploadPart).toHaveBeenCalledWith(
      chunk,
      expect.any(String),
      'upload-id-123',
      1,
      checksum,
    );
  });
});
