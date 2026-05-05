/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET, PATCH, DELETE } from '../route';
import { uploadService } from '@/lib/api/uploadService';
import { getCurrentSession } from '@/lib/auth/session';
import { canEditVideo, canDeleteVideo } from '@/lib/auth/permissions';
import { NextRequest } from 'next/server';

jest.mock('@/lib/api/uploadService');
jest.mock('@/lib/auth/session');
jest.mock('@/lib/auth/permissions');
jest.mock('@/lib/security/audit', () => ({
  recordSecurityEvent: jest.fn(),
}));

describe('Video Detail API Route', () => {
  const params = { videoId: 'v1' };
  const mockReq = (body: any = null) => ({
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('gets video details', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (uploadService.getVideo as jest.Mock).mockResolvedValue({
      id: 'v1', originalName: 'v.mp4', createdAt: new Date(), updatedAt: new Date(), status: 'ready', size: 10
    });

    const response = await GET(mockReq(), { params });
    expect(response.status).toBe(200);
    expect((await response.json()).video.id).toBe('v1');
  });

  it('updates video title', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN', email: 'a@t.com' } });
    (canEditVideo as unknown as jest.Mock).mockReturnValue(true);
    (uploadService.updateVideoTitle as jest.Mock).mockResolvedValue({
      id: 'v1', originalName: 'v.mp4', title: 'New Title', createdAt: new Date(), updatedAt: new Date(), status: 'ready', size: 10
    });

    const response = await PATCH(mockReq({ title: 'New Title' }), { params });
    expect(response.status).toBe(200);
    expect((await response.json()).video.title).toBe('New Title');
  });

  it('deletes video', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canDeleteVideo as unknown as jest.Mock).mockReturnValue(true);
    (uploadService.getVideo as jest.Mock).mockResolvedValue({ id: 'v1' });

    const response = await DELETE(mockReq(), { params });
    expect(response.status).toBe(200);
    expect(uploadService.deleteVideo).toHaveBeenCalledWith('v1');
  });

  it('returns 404 if video not found', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (uploadService.getVideo as jest.Mock).mockResolvedValue(null);
    const response = await GET(mockReq(), { params });
    expect(response.status).toBe(404);
  });
});
