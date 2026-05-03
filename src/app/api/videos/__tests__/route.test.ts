import { GET } from '../route';
import { uploadService } from '@/lib/api/uploadService';
import { getCurrentSession } from '@/lib/auth/session';
import { canSearchVideos } from '@/lib/auth/permissions';
import { NextRequest } from 'next/server';

jest.mock('@/lib/api/uploadService');
jest.mock('@/lib/auth/session');
jest.mock('@/lib/auth/permissions');
jest.mock('@/lib/security/audit', () => ({
  recordSecurityEvent: jest.fn(),
}));

describe('Videos API Route', () => {
  const mockReq = (url: string) => ({
    url,
    nextUrl: new URL(url),
  } as unknown as NextRequest);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns all videos when authenticated', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canSearchVideos as unknown as jest.Mock).mockReturnValue(true);
    (uploadService.getAllVideos as jest.Mock).mockResolvedValue([
      { id: '1', originalName: 'v1.mp4', createdAt: new Date(), updatedAt: new Date(), size: 10, status: 'completed' },
    ]);

    const req = mockReq('http://test.com/api/videos');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.videos).toHaveLength(1);
  });

  it('filters videos by query', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canSearchVideos as unknown as jest.Mock).mockReturnValue(true);
    (uploadService.getAllVideos as jest.Mock).mockResolvedValue([
      { id: '1', originalName: 'foo.mp4', createdAt: new Date(), updatedAt: new Date(), size: 10, status: 'completed' },
    ]);

    const req = mockReq('http://test.com/api/videos?q=foo');
    const response = await GET(req);
    const data = await response.json();

    expect(data.videos).toHaveLength(1);
    expect(data.videos[0].originalName).toBe('foo.mp4');
    expect(uploadService.getAllVideos).toHaveBeenCalledWith('foo');
  });

  it('returns 401 for unauthenticated', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue(null);
    const req = mockReq('http://test.com/api/videos');
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('returns 403 for unauthorized', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'USER' } });
    (canSearchVideos as unknown as jest.Mock).mockReturnValue(false);
    const req = mockReq('http://test.com/api/videos');
    const response = await GET(req);
    expect(response.status).toBe(403);
  });
});
