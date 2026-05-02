import { UploadService } from '../UploadService';
import { IStorageAdapter } from '@/lib/storage/IStorageAdapter';

const MB = 1024 * 1024;
const CHUNK_SIZE = 10 * MB;

jest.mock('../ThumbnailExtractor', () => ({
  ThumbnailExtractor: jest.fn().mockImplementation(() => ({
    extract: jest.fn(),
  })),
}));

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

describe('UploadService — multipart upload', () => {
  it('calls initiateMultipartUpload when file needs more than one chunk', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { totalChunks } = await svc.initiateUpload('video.mp4', 25 * MB, 'video/mp4');
    expect(totalChunks).toBe(3);
    expect(storage.initiateMultipartUpload).toHaveBeenCalledWith(
      expect.stringContaining('video.mp4'),
      'video/mp4',
    );
  });

  it('enforces the S3 minimum multipart chunk size when env is configured too low', async () => {
    const originalChunkSize = process.env.UPLOAD_CHUNK_SIZE_BYTES;
    process.env.UPLOAD_CHUNK_SIZE_BYTES = String(1024 * 1024);

    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { chunkSize, totalChunks } = await svc.initiateUpload('video.mp4', 12 * MB, 'video/mp4');

    expect(chunkSize).toBe(5 * MB);
    expect(totalChunks).toBe(3);

    if (originalChunkSize === undefined) {
      delete process.env.UPLOAD_CHUNK_SIZE_BYTES;
    } else {
      process.env.UPLOAD_CHUNK_SIZE_BYTES = originalChunkSize;
    }
  });

  it('does NOT call initiateMultipartUpload for single-chunk files', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { totalChunks } = await svc.initiateUpload('small.mp4', 4 * MB, 'video/mp4');
    expect(totalChunks).toBe(1);
    expect(storage.initiateMultipartUpload).not.toHaveBeenCalled();
  });

  it('calls uploadPart with correct partNumber (chunkIndex + 1) and stores ETag', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { sessionId } = await svc.initiateUpload('video.mp4', 25 * MB, 'video/mp4');
    await svc.uploadChunk(sessionId, 0, Buffer.alloc(CHUNK_SIZE));
    expect(storage.uploadPart).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.any(String),
      'upload-id-123',
      1,
      expect.any(String),
    );
  });

  it('calls storage.upload (not uploadPart) for single-chunk files', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { sessionId } = await svc.initiateUpload('small.mp4', 4 * MB, 'video/mp4');
    await svc.uploadChunk(sessionId, 0, Buffer.alloc(4 * MB));
    expect(storage.upload).toHaveBeenCalled();
    expect(storage.uploadPart).not.toHaveBeenCalled();
  });

  it('calls completeMultipartUpload with all accumulated ETags in order', async () => {
    const storage = makeStorage();
    storage.uploadPart
      .mockResolvedValueOnce('"etag-1"')
      .mockResolvedValueOnce('"etag-2"')
      .mockResolvedValueOnce('"etag-3"');
    const svc = new UploadService(storage);
    const { sessionId } = await svc.initiateUpload('video.mp4', 25 * MB, 'video/mp4');
    await svc.uploadChunk(sessionId, 0, Buffer.alloc(CHUNK_SIZE));
    await svc.uploadChunk(sessionId, 1, Buffer.alloc(CHUNK_SIZE));
    await svc.uploadChunk(sessionId, 2, Buffer.alloc(5 * MB));
    await svc.completeUpload(sessionId);
    expect(storage.completeMultipartUpload).toHaveBeenCalledWith(
      expect.any(String),
      'upload-id-123',
      [
        { PartNumber: 1, ETag: '"etag-1"' },
        { PartNumber: 2, ETag: '"etag-2"' },
        { PartNumber: 3, ETag: '"etag-3"' },
      ],
    );
  });

  it('uses getSignedUrl (not completeMultipartUpload) to finish single-chunk uploads', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { sessionId } = await svc.initiateUpload('small.mp4', 4 * MB, 'video/mp4');
    await svc.uploadChunk(sessionId, 0, Buffer.alloc(4 * MB));
    await svc.completeUpload(sessionId);
    expect(storage.completeMultipartUpload).not.toHaveBeenCalled();
    expect(storage.getSignedUrl).toHaveBeenCalled();
  });

  it('throws Invalid session for unknown sessionId in uploadChunk', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    await expect(svc.uploadChunk('bad-id', 0, Buffer.alloc(1))).rejects.toThrow('Invalid session');
  });

  it('throws Invalid session for unknown sessionId in completeUpload', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    await expect(svc.completeUpload('bad-id')).rejects.toThrow('Invalid session');
  });
});

describe('UploadService — Video metadata operations', () => {
  it('getVideo returns a video by ID', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { videoId } = await svc.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    const video = svc.getVideo(videoId);

    expect(video).toBeDefined();
    expect(video?.id).toBe(videoId);
    expect(video?.originalName).toBe('video.mp4');
    expect(video?.status).toBe('uploading');
    expect(video?.size).toBe(4 * MB);
  });

  it('getVideo returns undefined for non-existent video ID', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    const video = svc.getVideo('non-existent-id');

    expect(video).toBeUndefined();
  });

  it('getAllVideos returns all videos sorted by creation date (newest first)', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    const { videoId: id1 } = await svc.initiateUpload('video1.mp4', 4 * MB, 'video/mp4');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const { videoId: id2 } = await svc.initiateUpload('video2.mp4', 5 * MB, 'video/mp4');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const { videoId: id3 } = await svc.initiateUpload('video3.mp4', 6 * MB, 'video/mp4');

    const allVideos = svc.getAllVideos();

    expect(allVideos).toHaveLength(3);
    expect(allVideos[0].id).toBe(id3);
    expect(allVideos[1].id).toBe(id2);
    expect(allVideos[2].id).toBe(id1);
  });

  it('getAllVideos returns empty array when no videos exist', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    const allVideos = svc.getAllVideos();

    expect(allVideos).toEqual([]);
  });

  it('getAllVideos returns complete video metadata', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    const { videoId } = await svc.initiateUpload('test-video.mp4', 25 * MB, 'video/mp4');

    const allVideos = svc.getAllVideos();
    const video = allVideos[0];

    expect(video.id).toBe(videoId);
    expect(video.filename).toContain('test-video.mp4');
    expect(video.originalName).toBe('test-video.mp4');
    expect(video.title).toBe('test-video.mp4');
    expect(video.size).toBe(25 * MB);
    expect(video.mimeType).toBe('video/mp4');
    expect(video.status).toBe('uploading');
    expect(video.progress).toBe(0);
    expect(video.createdAt).toBeInstanceOf(Date);
    expect(video.updatedAt).toBeInstanceOf(Date);
  });

  it('updateVideoTitle updates the title and updatedAt timestamp', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { videoId } = await svc.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    const before = svc.getVideo(videoId)?.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 10));
    const updated = svc.updateVideoTitle(videoId, 'My Custom Title');
    const after = updated?.updatedAt;

    expect(updated).toBeDefined();
    expect(updated?.title).toBe('My Custom Title');
    expect(after!.getTime()).toBeGreaterThan(before!.getTime());
  });

  it('updateVideoTitle returns undefined for non-existent video', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    const result = svc.updateVideoTitle('non-existent-id', 'New Title');

    expect(result).toBeUndefined();
  });

  it('updateVideoTitle with empty string updates the title', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { videoId } = await svc.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    const updated = svc.updateVideoTitle(videoId, '');

    expect(updated?.title).toBe('');
  });

  it('deleteVideo removes video and calls storage.delete', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { videoId } = await svc.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    await svc.deleteVideo(videoId);

    expect(storage.delete).toHaveBeenCalledWith(expect.stringContaining('video.mp4'));
    expect(svc.getVideo(videoId)).toBeUndefined();
  });

  it('deleteVideo with thumbnail removes both video and thumbnail', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { videoId } = await svc.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    const video = svc.getVideo(videoId);
    if (video) {
      video.thumbnailUrl = 'http://storage/thumbnail.jpg';
    }

    await svc.deleteVideo(videoId);

    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(storage.delete).toHaveBeenCalledWith(expect.stringContaining('video.mp4'));
    expect(storage.delete).toHaveBeenCalledWith(expect.stringContaining(`thumbnails/${videoId}.jpg`));
  });

  it('deleteVideo silently handles thumbnail deletion errors', async () => {
    const storage = makeStorage();
    storage.delete.mockRejectedValueOnce(new Error('Thumbnail deletion failed')).mockResolvedValueOnce(undefined);

    const svc = new UploadService(storage);
    const { videoId } = await svc.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    const video = svc.getVideo(videoId);
    if (video) {
      video.thumbnailUrl = 'http://storage/thumbnail.jpg';
    }

    await expect(svc.deleteVideo(videoId)).resolves.not.toThrow();
    expect(svc.getVideo(videoId)).toBeUndefined();
  });

  it('deleteVideo is idempotent for non-existent video', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    await expect(svc.deleteVideo('non-existent-id')).resolves.not.toThrow();
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

describe('UploadService — Video status operations', () => {
  it('updateVideoStatus updates the status and updatedAt timestamp', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { videoId } = await svc.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    const before = svc.getVideo(videoId)?.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 10));
    svc.updateVideoStatus(videoId, 'processing');

    const video = svc.getVideo(videoId);
    expect(video?.status).toBe('processing');
    expect(video?.updatedAt.getTime()).toBeGreaterThan(before!.getTime());
  });

  it('updateVideoStatus is idempotent for non-existent video', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    expect(() => svc.updateVideoStatus('non-existent-id', 'ready')).not.toThrow();
  });
});

describe('UploadService — Complete upload flow with error cases', () => {
  it('completeUpload throws error when session does not exist', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    await expect(svc.completeUpload('invalid-session-id')).rejects.toThrow('Invalid session');
  });

  it('completeUpload with empty parts array on multipart upload', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { sessionId } = await svc.initiateUpload('video.mp4', 25 * MB, 'video/mp4');

    await svc.uploadChunk(sessionId, 0, Buffer.alloc(CHUNK_SIZE));
    await svc.uploadChunk(sessionId, 1, Buffer.alloc(CHUNK_SIZE));
    await svc.uploadChunk(sessionId, 2, Buffer.alloc(5 * MB));

    const video = await svc.completeUpload(sessionId);

    expect(video.status).toBe('processing');
    expect(video.progress).toBe(100);
    expect(storage.completeMultipartUpload).toHaveBeenCalled();
  });

  it('completeUpload with client-provided thumbnail uploads and sets thumbnail status', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { sessionId } = await svc.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    await svc.uploadChunk(sessionId, 0, Buffer.alloc(4 * MB));

    const thumbnail = Buffer.from('fake-image-data');
    const base64Thumbnail = `data:image/jpeg;base64,${thumbnail.toString('base64')}`;

    const video = await svc.completeUpload(sessionId, [], base64Thumbnail);

    expect(video.thumbnailStatus).toBe('ready');
    expect(video.thumbnailUrl).toBeDefined();
  });

  it('completeUpload falls back to thumbnail extraction on upload failure', async () => {
    const storage = makeStorage();
    storage.upload.mockRejectedValueOnce(new Error('Upload failed'));

    const svc = new UploadService(storage);
    const { sessionId } = await svc.initiateUpload('video.mp4', 25 * MB, 'video/mp4');

    await svc.uploadChunk(sessionId, 0, Buffer.alloc(CHUNK_SIZE));
    await svc.uploadChunk(sessionId, 1, Buffer.alloc(CHUNK_SIZE));
    await svc.uploadChunk(sessionId, 2, Buffer.alloc(5 * MB));

    const thumbnail = Buffer.from('invalid-base64');
    const base64Thumbnail = `data:image/jpeg;base64,${thumbnail.toString('base64')}`;

    const video = await svc.completeUpload(sessionId, [], base64Thumbnail);

    expect(video.status).toBe('processing');
  });

  it('completeUpload sets correct URLs for completed upload', async () => {
    const storage = makeStorage();
    storage.getSignedUrl.mockResolvedValueOnce('http://storage/signed-url');

    const svc = new UploadService(storage);
    const { sessionId } = await svc.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    await svc.uploadChunk(sessionId, 0, Buffer.alloc(4 * MB));
    const video = await svc.completeUpload(sessionId);

    expect(video.url).toBe('http://storage/signed-url');
    expect(video.downloadUrl).toBe('http://storage/signed-url');
  });

  it('completeUpload cleans up session after completion', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { sessionId } = await svc.initiateUpload('video.mp4', 4 * MB, 'video/mp4');

    await svc.uploadChunk(sessionId, 0, Buffer.alloc(4 * MB));
    await svc.completeUpload(sessionId);

    // Session should be deleted after completion
    await expect(svc.uploadChunk(sessionId, 0, Buffer.alloc(1))).rejects.toThrow('Invalid session');
  });
});

describe('UploadService — initializeMultipartUpload method coverage', () => {
  it('initiateUpload with valid metadata creates session and video', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    const result = await svc.initiateUpload('video.mp4', 25 * MB, 'video/mp4');

    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('videoId');
    expect(result).toHaveProperty('chunkSize');
    expect(result).toHaveProperty('totalChunks');
    expect(result).toHaveProperty('presignedUrls');
    expect(result.totalChunks).toBe(3);
  });

  it('initiateUpload generates unique IDs for each call', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    const result1 = await svc.initiateUpload('video1.mp4', 4 * MB, 'video/mp4');
    const result2 = await svc.initiateUpload('video2.mp4', 4 * MB, 'video/mp4');

    expect(result1.sessionId).not.toBe(result2.sessionId);
    expect(result1.videoId).not.toBe(result2.videoId);
  });

  it('initiateUpload sets default MIME type when not provided', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    const result = await svc.initiateUpload('video.mp4', 4 * MB);
    const video = svc.getVideo(result.videoId);

    expect(video?.mimeType).toBeUndefined();
    expect(storage.getUploadPresignedUrl).toHaveBeenCalledWith(
      expect.any(String),
      'application/octet-stream',
      expect.any(Number),
    );
    expect(storage.initiateMultipartUpload).not.toHaveBeenCalled();
  });

  it('initiateUpload generates correct number of presigned URLs', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    const result = await svc.initiateUpload('video.mp4', 25 * MB, 'video/mp4');

    expect(result.presignedUrls).toHaveLength(3);
    expect(storage.getUploadPartPresignedUrl).toHaveBeenCalledTimes(3);
  });

  it('initiateUpload with single chunk file generates one presigned URL', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    const result = await svc.initiateUpload('small.mp4', 4 * MB, 'video/mp4');

    expect(result.presignedUrls).toHaveLength(1);
    expect(storage.getUploadPresignedUrl).toHaveBeenCalledTimes(1);
  });
});

describe('UploadService — uploadPart detailed coverage', () => {
  it('uploadPart stores correct part number starting from 1', async () => {
    const storage = makeStorage();
    storage.uploadPart
      .mockResolvedValueOnce('"etag-1"')
      .mockResolvedValueOnce('"etag-2"');

    const svc = new UploadService(storage);
    const { sessionId } = await svc.initiateUpload('video.mp4', 25 * MB, 'video/mp4');

    await svc.uploadChunk(sessionId, 0, Buffer.alloc(CHUNK_SIZE));
    await svc.uploadChunk(sessionId, 1, Buffer.alloc(CHUNK_SIZE));

    expect(storage.uploadPart).toHaveBeenNthCalledWith(
      1,
      expect.any(Buffer),
      expect.any(String),
      'upload-id-123',
      1,
      expect.any(String),
    );
    expect(storage.uploadPart).toHaveBeenNthCalledWith(
      2,
      expect.any(Buffer),
      expect.any(String),
      'upload-id-123',
      2,
      expect.any(String),
    );
  });

  it('uploadChunk updates progress correctly for multipart upload', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);
    const { sessionId, videoId } = await svc.initiateUpload('video.mp4', 25 * MB, 'video/mp4');

    await svc.uploadChunk(sessionId, 0, Buffer.alloc(CHUNK_SIZE));
    let video = svc.getVideo(videoId);
    expect(video?.progress).toBeCloseTo(33.33, 1);

    await svc.uploadChunk(sessionId, 1, Buffer.alloc(CHUNK_SIZE));
    video = svc.getVideo(videoId);
    expect(video?.progress).toBeCloseTo(66.66, 1);

    await svc.uploadChunk(sessionId, 2, Buffer.alloc(5 * MB));
    video = svc.getVideo(videoId);
    expect(video?.progress).toBe(100);
  });

  it('uploadChunk throws for invalid session', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage);

    await expect(svc.uploadChunk('bad-session', 0, Buffer.alloc(CHUNK_SIZE))).rejects.toThrow(
      'Invalid session',
    );
  });
});
