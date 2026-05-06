import { UploadService } from '../UploadService';
import { IStorageAdapter } from '@/lib/storage/IStorageAdapter';
import type { PersistedUploadState, Video } from '@/types';
import type { UploadStateStore } from '@/lib/persistence/IngestUploadStateClient';
import { videoEvents } from '@/lib/VideoEventEmitter';

const MB = 1024 * 1024;
const CHUNK_SIZE = 5 * MB;

jest.mock('../ThumbnailExtractor', () => ({
  ThumbnailExtractor: jest.fn().mockImplementation(() => ({
    extract: jest.fn(),
  })),
}));

const { ThumbnailExtractor } = jest.requireMock('../ThumbnailExtractor') as {
  ThumbnailExtractor: jest.Mock;
};

function makeStorage(): jest.Mocked<IStorageAdapter> {
  return {
    upload: jest.fn().mockResolvedValue('http://storage/file'),
    getUploadPresignedUrl: jest.fn().mockResolvedValue('http://storage/presigned-put'),
    initiateMultipartUpload: jest.fn().mockResolvedValue('upload-id-123'),
    uploadPart: jest.fn().mockResolvedValue('"etag-abc"'),
    getUploadPartPresignedUrl: jest.fn().mockResolvedValue('http://storage/presigned-part'),
    completeMultipartUpload: jest.fn().mockResolvedValue('http://storage/file'),
    delete: jest.fn().mockResolvedValue(undefined),
    getSignedUrl: jest.fn().mockResolvedValue('http://storage/signed'),
    exists: jest.fn().mockResolvedValue(false),
    listObjects: jest.fn().mockResolvedValue([]),
  };
}

class FakeStateStore implements UploadStateStore {
  public failUpdate = false;
  private readonly states = new Map<string, PersistedUploadState>();
  private readonly videos = new Map<string, Video>();

  async saveState(state: PersistedUploadState): Promise<void> {
    this.states.set(state.session.id, {
      session: { ...state.session, etags: [...state.session.etags] },
      video: { ...state.video },
    });
    this.videos.set(state.video.id, { ...state.video });
  }

  async getState(sessionId: string): Promise<PersistedUploadState | null> {
    const state = this.states.get(sessionId);
    return state
      ? {
          session: { ...state.session, etags: [...state.session.etags] },
          video: { ...state.video },
        }
      : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.states.delete(sessionId);
  }

  async saveVideo(video: Video): Promise<void> {
    this.videos.set(video.id, { ...video });
  }

  async getVideo(videoId: string): Promise<Video | null> {
    const video = this.videos.get(videoId);
    return video ? { ...video } : null;
  }

  async listVideos(query?: string): Promise<Video[]> {
    const values = Array.from(this.videos.values())
      .filter((video) => !query || [video.title, video.originalName].some(value => value.toLowerCase().includes(query.toLowerCase())))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(video => ({ ...video }));

    return values;
  }

  async updateVideo(videoId: string, patch: Partial<Video>): Promise<Video | null> {
    if (this.failUpdate) {
      throw new Error('update failed');
    }
    const current = this.videos.get(videoId);
    if (!current) {
      return null;
    }

    const updated = { ...current, ...patch };
    this.videos.set(videoId, updated);
    return { ...updated };
  }

  async deleteVideo(videoId: string): Promise<void> {
    this.videos.delete(videoId);
  }
}

function makeService(storage = makeStorage(), stateStore = new FakeStateStore()) {
  const service = new UploadService(storage, {
    stateStore,
    storage: {
      encryptionEnabled: false,
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

  return { service, stateStore, storage };
}

describe('UploadService persistence-backed flow', () => {
  it('creates persisted session and video during initiation', async () => {
    const { service, stateStore, storage } = makeService();

    const result = await service.initiateUpload('video.mp4', 12 * MB, 'video/mp4');
    const state = await stateStore.getState(result.sessionId);

    expect(result.totalChunks).toBe(3);
    expect(state?.session.videoId).toBe(result.videoId);
    expect(state?.video.originalName).toBe('video.mp4');
    expect(storage.initiateMultipartUpload).toHaveBeenCalled();
  });

  it('enforces the minimum multipart chunk size from env', async () => {
    const originalChunkSize = process.env.UPLOAD_CHUNK_SIZE_BYTES;
    process.env.UPLOAD_CHUNK_SIZE_BYTES = String(MB);

    const { service } = makeService();
    const result = await service.initiateUpload('video.mp4', 12 * MB, 'video/mp4');

    expect(result.chunkSize).toBe(5 * MB);
    expect(result.totalChunks).toBe(3);

    if (originalChunkSize === undefined) {
      delete process.env.UPLOAD_CHUNK_SIZE_BYTES;
    } else {
      process.env.UPLOAD_CHUNK_SIZE_BYTES = originalChunkSize;
    }
  });

  it('falls back to default security policies when optional config is omitted', async () => {
    const storage = makeStorage();
    const stateStore = new FakeStateStore();
    const service = new UploadService(storage, { stateStore });

    const result = await service.initiateUpload('video.mp4', 4 * MB);

    expect(result.totalChunks).toBe(1);
    expect(storage.getUploadPresignedUrl).toHaveBeenCalledWith(
      expect.any(String),
      'application/octet-stream',
      expect.any(Number),
    );
  });

  it('uploads multipart chunks and persists progress', async () => {
    const { service, stateStore, storage } = makeService();
    const { sessionId, videoId } = await service.initiateUpload('video.mp4', 12 * MB, 'video/mp4');

    await service.uploadChunk(sessionId, 0, Buffer.alloc(CHUNK_SIZE));
    await service.uploadChunk(sessionId, 1, Buffer.alloc(CHUNK_SIZE));

    const state = await stateStore.getState(sessionId);
    const video = await stateStore.getVideo(videoId);

    expect(storage.uploadPart).toHaveBeenNthCalledWith(
      1,
      expect.any(Buffer),
      expect.any(String),
      'upload-id-123',
      1,
      expect.any(String),
    );
    expect(state?.session.uploadedChunks).toBe(2);
    expect(video?.progress).toBeCloseTo(66.66, 1);
    expect(state?.session.etags).toHaveLength(2);
  });

  it('uses direct upload path for single chunk files', async () => {
    const { service, storage } = makeService();
    const { sessionId } = await service.initiateUpload('small.mp4', 4 * MB);

    await service.uploadChunk(sessionId, 0, Buffer.alloc(4 * MB));

    expect(storage.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.any(String),
      'application/octet-stream',
      expect.any(String),
    );
    expect(storage.uploadPart).not.toHaveBeenCalled();
  });

  it('completes upload, persists final video, and deletes the session', async () => {
    const { service, stateStore, storage } = makeService();
    const { sessionId, videoId } = await service.initiateUpload('video.mp4', 12 * MB, 'video/mp4');

    await service.uploadChunk(sessionId, 0, Buffer.alloc(CHUNK_SIZE));
    await service.uploadChunk(sessionId, 1, Buffer.alloc(CHUNK_SIZE));
    await service.uploadChunk(sessionId, 2, Buffer.alloc(2 * MB));

    const video = await service.completeUpload(sessionId);

    expect(storage.completeMultipartUpload).toHaveBeenCalledWith(
      expect.any(String),
      'upload-id-123',
      expect.arrayContaining([{ PartNumber: 1, ETag: '"etag-abc"' }]),
    );
    expect(video.status).toBe('processing');
    expect(video.downloadUrl).toBe('http://storage/file');
    expect(await stateStore.getState(sessionId)).toBeNull();
    expect((await stateStore.getVideo(videoId))?.status).toBe('processing');
  });

  it('prefers explicit etags passed at completion time', async () => {
    const { service, storage } = makeService();
    const { sessionId } = await service.initiateUpload('video.mp4', 12 * MB, 'video/mp4');
    await service.uploadChunk(sessionId, 0, Buffer.alloc(CHUNK_SIZE));
    await service.uploadChunk(sessionId, 1, Buffer.alloc(CHUNK_SIZE));
    await service.uploadChunk(sessionId, 2, Buffer.alloc(2 * MB));

    await service.completeUpload(sessionId, [
      { PartNumber: 1, ETag: 'etag-1' },
      { PartNumber: 2, ETag: 'etag-2' },
      { PartNumber: 3, ETag: 'etag-3' },
    ]);

    expect(storage.completeMultipartUpload).toHaveBeenCalledWith(
      expect.any(String),
      'upload-id-123',
      [
        { PartNumber: 1, ETag: 'etag-1' },
        { PartNumber: 2, ETag: 'etag-2' },
        { PartNumber: 3, ETag: 'etag-3' },
      ],
    );
  });

  it('throws Invalid session when the persisted state is missing', async () => {
    const { service } = makeService();

    await expect(service.uploadChunk('missing', 0, Buffer.alloc(1))).rejects.toThrow('Invalid session');
    await expect(service.completeUpload('missing')).rejects.toThrow('Invalid session');
  });

  it('supports metadata reads, search, title update, and delete through the store', async () => {
    const { service, stateStore, storage } = makeService();
    const first = await service.initiateUpload('alpha.mp4', 4 * MB, 'video/mp4');
    await new Promise(resolve => setTimeout(resolve, 10));
    const second = await service.initiateUpload('beta.mp4', 4 * MB, 'video/mp4');

    const all = await service.getAllVideos();
    const filtered = await service.getAllVideos('beta');
    const updated = await service.updateVideoTitle(second.videoId, 'My Beta');

    await stateStore.updateVideo(second.videoId, { thumbnailUrl: 'http://storage/thumb.jpg' });
    await service.deleteVideo(second.videoId);

    expect((await service.getVideo(first.videoId))?.originalName).toBe('alpha.mp4');
    expect(all.map(video => video.id)).toEqual([second.videoId, first.videoId]);
    expect(filtered).toHaveLength(1);
    expect(updated?.title).toBe('My Beta');
    expect(storage.delete).toHaveBeenCalledWith(expect.stringContaining('beta.mp4'));
    expect(await service.getVideo(second.videoId)).toBeUndefined();
  });

  it('returns undefined when title update targets a missing video', async () => {
    const { service } = makeService();
    await expect(service.updateVideoTitle('missing', 'x')).resolves.toBeUndefined();
  });

  it('does nothing when deleting a missing video', async () => {
    const { service, storage } = makeService();
    await service.deleteVideo('missing');
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('marks thumbnail as ready when a client thumbnail is uploaded during completion', async () => {
    const { service, stateStore } = makeService();
    const { sessionId, videoId } = await service.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    await service.uploadChunk(sessionId, 0, Buffer.alloc(4 * MB));
    const thumbnail = `data:image/jpeg;base64,${Buffer.from('thumb').toString('base64')}`;

    await service.completeUpload(sessionId, [], thumbnail);

    expect((await stateStore.getVideo(videoId))?.thumbnailStatus).toBe('ready');
  });

  it('updates status asynchronously through the persistence store', async () => {
    jest.useFakeTimers();
    const { service, stateStore } = makeService();
    const { sessionId, videoId } = await service.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    await service.uploadChunk(sessionId, 0, Buffer.alloc(4 * MB));
    await service.completeUpload(sessionId);
    await jest.advanceTimersByTimeAsync(2000);

    expect((await stateStore.getVideo(videoId))?.status).toBe('ready');
    jest.useRealTimers();
  });

  it('persists thumbnail fallback events emitted after completion', async () => {
    const { service, stateStore } = makeService();
    const { sessionId, videoId } = await service.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    await service.uploadChunk(sessionId, 0, Buffer.alloc(4 * MB));
    await service.completeUpload(sessionId);
    await new Promise(resolve => setTimeout(resolve, 0));

    videoEvents.emitThumbnailFallback(videoId, 'http://storage/fallback.jpg', 'storage_error', new Date().toISOString());
    await new Promise(resolve => setTimeout(resolve, 0));

    const video = await stateStore.getVideo(videoId);
    expect(video?.thumbnailStatus).toBe('failed');
    expect(video?.thumbnailUrl).toBe('http://storage/fallback.jpg');
  });

  it('falls back to extractor when client thumbnail upload fails', async () => {
    const storage = makeStorage();
    storage.upload
      .mockResolvedValueOnce('http://storage/file')
      .mockRejectedValueOnce(new Error('thumb failed'));
    const { service } = makeService(storage);
    const extractor = ThumbnailExtractor.mock.results.at(-1)?.value;
    const { sessionId } = await service.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    await service.uploadChunk(sessionId, 0, Buffer.alloc(4 * MB));
    const thumbnail = `data:image/jpeg;base64,${Buffer.from('thumb').toString('base64')}`;
    await service.completeUpload(sessionId, [], thumbnail);

    expect(extractor.extract).toHaveBeenCalled();
  });

  it('swallows ready-transition persistence failures', async () => {
    jest.useFakeTimers();
    const { service, stateStore } = makeService();
    stateStore.failUpdate = true;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { sessionId } = await service.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    await service.uploadChunk(sessionId, 0, Buffer.alloc(4 * MB));
    await service.completeUpload(sessionId);
    await jest.advanceTimersByTimeAsync(2000);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to persist ready status:', expect.any(Error));
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });
});
