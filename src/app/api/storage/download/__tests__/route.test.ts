import { GET } from '../route';
import { readMemoryObject, resolveMemoryDownloadTarget } from '@/lib/storage/MemoryAdapter';
import { NextRequest } from 'next/server';

jest.mock('@/lib/storage/MemoryAdapter', () => ({
  readMemoryObject: jest.fn(),
  resolveMemoryDownloadTarget: jest.fn(),
}));

describe('Storage Download API Route', () => {
  const mockReq = (token: string | null) => ({
    nextUrl: {
      searchParams: {
        get: jest.fn().mockReturnValue(token),
      },
    },
  } as unknown as NextRequest);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('downloads successfully with valid token', async () => {
    (resolveMemoryDownloadTarget as jest.Mock).mockReturnValue({ key: 'test.mp4' });
    (readMemoryObject as jest.Mock).mockReturnValue({
      body: new ArrayBuffer(10),
      contentType: 'video/mp4',
    });

    const req = mockReq('valid-token');
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('video/mp4');
  });

  it('returns 400 for missing token', async () => {
    const req = mockReq(null);
    const response = await GET(req);
    expect(response.status).toBe(400);
  });

  it('returns 404 for invalid token', async () => {
    (resolveMemoryDownloadTarget as jest.Mock).mockReturnValue(null);
    const req = mockReq('invalid');
    const response = await GET(req);
    expect(response.status).toBe(404);
  });

  it('returns 404 for missing object', async () => {
    (resolveMemoryDownloadTarget as jest.Mock).mockReturnValue({ key: 'missing' });
    (readMemoryObject as jest.Mock).mockReturnValue(null);
    const req = mockReq('valid');
    const response = await GET(req);
    expect(response.status).toBe(404);
  });
});
