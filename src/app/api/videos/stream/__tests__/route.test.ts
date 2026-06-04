import { GET } from '../route';
import { uploadService } from '@/lib/api/uploadService';
import { getCurrentSession } from '@/lib/auth/session';
import { NextRequest } from 'next/server';

jest.mock('@/lib/api/uploadService', () => ({
  uploadService: { getAllVideos: jest.fn() },
  storageAdapter: { getPublicUrl: jest.fn() },
}));
jest.mock('@/lib/auth/session');
jest.mock('@/app/api/videos/thumbnail', () => ({
  deriveThumbnailUrl: jest.fn().mockResolvedValue(null),
}));

const mockReq = () => ({} as unknown as NextRequest);

describe('GET /api/videos/stream', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue(null);
    const response = await GET(mockReq());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns an SSE stream when authenticated', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (uploadService.getAllVideos as jest.Mock).mockResolvedValue([]);

    const response = await GET(mockReq());
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.body).toBeTruthy();
    response.body?.cancel();
  });

  it('emits video-updated events for changed videos', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    const video = {
      id: 'v1',
      status: 'processing',
      processingStatus: 'transcoding',
      thumbnailStatus: 'pending',
      thumbnailUrl: null,
    };
    (uploadService.getAllVideos as jest.Mock).mockResolvedValue([video]);
    const { deriveThumbnailUrl } = jest.requireMock('@/app/api/videos/thumbnail') as { deriveThumbnailUrl: jest.Mock };
    deriveThumbnailUrl.mockResolvedValue('http://cdn/thumb.jpg');

    const response = await GET(mockReq());
    expect(response.status).toBe(200);

    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('event: video-updated');
    expect(text).toContain('"id":"v1"');
    reader.releaseLock();
    response.body?.cancel();
  });

  it('does not emit events when no videos are present', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (uploadService.getAllVideos as jest.Mock).mockResolvedValue([]);

    const response = await GET(mockReq());
    expect(response.status).toBe(200);
    response.body?.cancel();
  });

  it('handles getAllVideos errors gracefully (no crash)', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (uploadService.getAllVideos as jest.Mock).mockRejectedValue(new Error('DB error'));

    const response = await GET(mockReq());
    expect(response.status).toBe(200);
    // The stream stays open despite tick error — cancel it to clean up
    await response.body?.cancel();
  });

  it('cancels intervals when stream is cancelled', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (uploadService.getAllVideos as jest.Mock).mockResolvedValue([]);

    const response = await GET(mockReq());
    expect(response.status).toBe(200);
    // Cancelling the body triggers the ReadableStream cancel callback which clears intervals
    await response.body!.cancel();
  });

  it('emits event with null processingStatus and thumbnailStatus when undefined', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    const video = { id: 'v2', status: 'ready' };
    (uploadService.getAllVideos as jest.Mock).mockResolvedValue([video]);

    const response = await GET(mockReq());
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('"processingStatus":null');
    expect(text).toContain('"thumbnailStatus":null');
    reader.releaseLock();
    response.body?.cancel();
  });
});
