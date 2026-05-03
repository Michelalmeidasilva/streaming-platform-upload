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

  it('handles internal errors', async () => {
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
    (canUploadVideo as unknown as jest.Mock).mockReturnValue(true);
    (uploadService.initiateUpload as jest.Mock).mockRejectedValue(new Error('Fail'));
    const req = mockReq({ filename: 'v.mp4', size: 10 });
    const response = await POST(req);
    expect(response.status).toBe(500);
  });
});
