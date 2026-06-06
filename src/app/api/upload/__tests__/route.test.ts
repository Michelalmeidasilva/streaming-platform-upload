/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST } from '../route';
import { uploadService } from '@/lib/api/uploadService';
import { getCurrentSession } from '@/lib/auth/session';
import { canUploadVideo } from '@/lib/auth/permissions';
import { NextRequest } from 'next/server';

jest.mock('@/lib/api/uploadService');
jest.mock('@/lib/auth/session');
jest.mock('@/lib/auth/permissions');
jest.mock('@/lib/security/audit', () => ({
  recordSecurityEvent: jest.fn(),
}));

describe('Upload API Route', () => {
  const mockReq = (body: any) => ({
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('initiates upload successfully', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN', email: 'a@t.com' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    (uploadService.initiateUpload as jest.Mock).mockResolvedValue({
      sessionId: 's1',
      videoId: 'v1',
      chunkSize: 100,
      totalChunks: 1,
      presignedUrls: ['url'],
    });

    const req = mockReq({ filename: 'test.mp4', size: 100 });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe('s1');
  });

  it('returns 401 when not authenticated', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue(null);
    const req = mockReq({});
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('returns 403 when not authorized', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'USER' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(false);
    const req = mockReq({});
    const response = await POST(req);
    expect(response.status).toBe(403);
  });

  it('returns 400 for missing filename/size', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    const req = mockReq({ filename: '' });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('returns 400 for unsupported file extension', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    const req = mockReq({ filename: 'shell.php', size: 1000, mimeType: 'application/x-php' });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Unsupported file format');
  });

  it('returns 400 for unsupported MIME type with valid extension', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    const req = mockReq({ filename: 'video.mp4', size: 1000, mimeType: 'application/x-php' });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Unsupported MIME type');
  });

  it('returns 400 for file exceeding 5 GB', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    const req = mockReq({ filename: 'video.mp4', size: 6 * 1024 * 1024 * 1024 });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('5 GB');
  });

  it('accepts a 6 GB file when UPLOAD_MAX_FILE_SIZE_GB raises the limit to 10', async () => {
    const original = process.env.UPLOAD_MAX_FILE_SIZE_GB;
    process.env.UPLOAD_MAX_FILE_SIZE_GB = '10';
    try {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN', email: 'a@t.com' } });
      (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
      (uploadService.initiateUpload as jest.Mock).mockResolvedValue({
        sessionId: 's1', videoId: 'v1', chunkSize: 100, totalChunks: 1, presignedUrls: ['url'],
      });
      const req = mockReq({ filename: 'video.mp4', size: 6 * 1024 * 1024 * 1024 });
      const response = await POST(req);
      expect(response.status).toBe(200);
    } finally {
      process.env.UPLOAD_MAX_FILE_SIZE_GB = original;
    }
  });

  it('reports the configured limit in the oversize error message', async () => {
    const original = process.env.UPLOAD_MAX_FILE_SIZE_GB;
    process.env.UPLOAD_MAX_FILE_SIZE_GB = '10';
    try {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
      const req = mockReq({ filename: 'video.mp4', size: 11 * 1024 * 1024 * 1024 });
      const response = await POST(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('10 GB');
    } finally {
      process.env.UPLOAD_MAX_FILE_SIZE_GB = original;
    }
  });

  it('accepts .y4m without a canonical MIME type', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    (uploadService.initiateUpload as jest.Mock).mockResolvedValue({
      sessionId: 's1', videoId: 'v1', chunkSize: 100, totalChunks: 1, presignedUrls: ['url'],
    });
    const req = mockReq({ filename: 'clip.y4m', size: 1000, mimeType: 'application/octet-stream' });
    const response = await POST(req);
    expect(response.status).toBe(200);
  });

  it('accepts .mkv with the non-canonical MIME types browsers report', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    (uploadService.initiateUpload as jest.Mock).mockResolvedValue({
      sessionId: 's1', videoId: 'v1', chunkSize: 100, totalChunks: 1, presignedUrls: ['url'],
    });
    // Safari sends video/matroska (no x-); see route.ts NO_CANONICAL_MIME_EXTENSIONS.
    for (const mimeType of ['video/matroska', 'video/x-matroska', 'application/octet-stream', '']) {
      const req = mockReq({ filename: 'The Boys S05E07.mkv', size: 1000, mimeType });
      const response = await POST(req);
      expect(response.status).toBe(200);
    }
  });

  it('returns 400 for .yuv without rawVideo metadata', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    const req = mockReq({ filename: 'raw.yuv', size: 1000 });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('width, height and fps');
  });

  it('forwards rawVideo metadata to initiateUpload for .yuv', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    (uploadService.initiateUpload as jest.Mock).mockResolvedValue({
      sessionId: 's1', videoId: 'v1', chunkSize: 100, totalChunks: 1, presignedUrls: ['url'],
    });
    const rawVideo = { width: 1920, height: 1080, fps: 30, pixelFormat: 'yuv420p' };
    const req = mockReq({ filename: 'raw.yuv', size: 1000, rawVideo });
    const response = await POST(req);
    expect(response.status).toBe(200);
    expect(uploadService.initiateUpload).toHaveBeenCalledWith('raw.yuv', 1000, undefined, rawVideo, undefined);
  });

  it('forwards subtitles and returns subtitleUploads', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    const subtitleUploads = [{ objectKey: 'subtitles/v1/en.srt', url: 'https://put/en', language: 'en' }];
    (uploadService.initiateUpload as jest.Mock).mockResolvedValue({
      sessionId: 's1', videoId: 'v1', chunkSize: 100, totalChunks: 1, presignedUrls: ['url'], subtitleUploads,
    });
    const subtitles = [{ language: 'en', label: 'EN' }];
    const req = mockReq({ filename: 'movie.mp4', size: 1000, mimeType: 'video/mp4', subtitles });
    const response = await POST(req);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(uploadService.initiateUpload).toHaveBeenCalledWith('movie.mp4', 1000, 'video/mp4', undefined, subtitles);
    expect(data.subtitleUploads).toEqual(subtitleUploads);
  });

  it('handles internal errors', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    (uploadService.initiateUpload as jest.Mock).mockRejectedValue(new Error('Fail'));
    const req = mockReq({ filename: 'v.mp4', size: 10 });
    const response = await POST(req);
    expect(response.status).toBe(500);
  });
});
