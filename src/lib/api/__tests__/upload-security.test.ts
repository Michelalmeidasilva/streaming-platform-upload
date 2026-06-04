import { createHash } from 'crypto';
import { UploadService } from '@/lib/services/UploadService';
import { IStorageAdapter } from '@/lib/storage/IStorageAdapter';
import type { PersistedUploadState, Video } from '@/types';
import type { UploadStateStore } from '@/lib/persistence/IngestUploadStateClient';

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
    getPublicUrl: jest.fn().mockResolvedValue('https://storage.example/object'),
    exists: jest.fn().mockResolvedValue(false),
    listObjects: jest.fn().mockResolvedValue([]),
  };
}

class MemoryStateStore implements UploadStateStore {
  private readonly states = new Map<string, PersistedUploadState>();
  private readonly videos = new Map<string, Video>();

  async saveState(state: PersistedUploadState): Promise<void> {
    this.states.set(state.session.id, state);
    this.videos.set(state.video.id, state.video);
  }

  async getState(sessionId: string): Promise<PersistedUploadState | null> {
    return this.states.get(sessionId) || null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.states.delete(sessionId);
  }

  async saveVideo(video: Video): Promise<void> {
    this.videos.set(video.id, video);
  }

  async getVideo(videoId: string): Promise<Video | null> {
    return this.videos.get(videoId) || null;
  }

  async listVideos(): Promise<Video[]> {
    return Array.from(this.videos.values());
  }

  async updateVideo(videoId: string, patch: Partial<Video>): Promise<Video | null> {
    const video = this.videos.get(videoId);
    if (!video) {
      return null;
    }

    const updated = { ...video, ...patch };
    this.videos.set(videoId, updated);
    return updated;
  }

  async deleteVideo(videoId: string): Promise<void> {
    this.videos.delete(videoId);
  }
}

function makeService(storage = makeStorage()) {
  return new UploadService(storage, {
    stateStore: new MemoryStateStore(),
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
}

describe('upload security metadata', () => {
  it('carries the storage and recovery posture onto created videos', async () => {
    const storage = makeStorage();
    const service = makeService(storage);
    const { videoId } = await service.initiateUpload('video.mp4', 2 * 1024 * 1024, 'video/mp4');

    const video = await service.getVideo(videoId);
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
    const service = makeService(storage);
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
