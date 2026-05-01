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
