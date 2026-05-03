import { PUT } from '../route';
import { resolveMemoryUploadTarget, storeMemoryUpload } from '@/lib/storage/MemoryAdapter';
import type { NextRequest } from 'next/server';

jest.mock('@/lib/storage/MemoryAdapter', () => ({
  resolveMemoryUploadTarget: jest.fn(),
  storeMemoryUpload: jest.fn(),
}));

describe('Storage Upload API', () => {
  const mockReq = (token: string | null, body = new ArrayBuffer(0)) => {
    return {
      nextUrl: {
        searchParams: {
          get: jest.fn().mockReturnValue(token),
        },
      },
      arrayBuffer: jest.fn().mockResolvedValue(body),
      headers: {
        get: jest.fn().mockReturnValue('application/octet-stream'),
      },
    } as unknown as NextRequest;
  };

  it('uploads successfully with valid token', async () => {
    (resolveMemoryUploadTarget as jest.Mock).mockReturnValue({ key: 'test.mp4' });
    (storeMemoryUpload as jest.Mock).mockReturnValue('mock-etag');

    const req = mockReq('valid-token');
    const response = await PUT(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBe('"mock-etag"');
  });

  it('returns 400 for missing token', async () => {
    const req = mockReq(null);
    const response = await PUT(req);
    expect(response.status).toBe(400);
  });

  it('returns 404 for invalid token', async () => {
    (resolveMemoryUploadTarget as jest.Mock).mockReturnValue(null);
    const req = mockReq('invalid-token');
    const response = await PUT(req);
    expect(response.status).toBe(404);
  });
});
