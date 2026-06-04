/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET } from '../route';
import { uploadService, storageAdapter } from '@/lib/api/uploadService';

jest.mock('@/lib/api/uploadService', () => ({
  uploadService: { getVideo: jest.fn() },
  storageAdapter: { getSignedUrl: jest.fn() },
}));

const fakeUpstream = (bytes: number[], contentType = 'image/jpeg') => ({
  ok: true,
  headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
});

describe('GET /api/videos/[videoId]/thumbnail (same-origin proxy)', () => {
  const params = { videoId: 'v1' };

  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = jest.fn();
  });

  it('returns 404 when the video does not exist', async () => {
    (uploadService.getVideo as jest.Mock).mockResolvedValue(null);

    const res = await GET({} as any, { params });

    expect(res.status).toBe(404);
    expect(storageAdapter.getSignedUrl).not.toHaveBeenCalled();
  });

  it('streams the primary thumbnail object as image/jpeg using the internal (signed) URL', async () => {
    (uploadService.getVideo as jest.Mock).mockResolvedValue({ id: 'v1', thumbnailStatus: 'ready' });
    (storageAdapter.getSignedUrl as jest.Mock).mockResolvedValue('http://minio:9000/videos/thumbnails/v1.jpg?sig=abc');
    (global as any).fetch.mockResolvedValue(fakeUpstream([1, 2, 3, 4]));

    const res = await GET({} as any, { params });

    expect(storageAdapter.getSignedUrl).toHaveBeenCalledWith('thumbnails/v1.jpg');
    expect((global as any).fetch).toHaveBeenCalledWith('http://minio:9000/videos/thumbnails/v1.jpg?sig=abc');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    const body = Buffer.from(await res.arrayBuffer());
    expect(Array.from(body)).toEqual([1, 2, 3, 4]);
  });

  it('serves the fallback object when thumbnailStatus is failed', async () => {
    (uploadService.getVideo as jest.Mock).mockResolvedValue({ id: 'v1', thumbnailStatus: 'failed' });
    (storageAdapter.getSignedUrl as jest.Mock).mockResolvedValue('http://minio:9000/videos/thumbnails/v1-fallback.jpg?sig=abc');
    (global as any).fetch.mockResolvedValue(fakeUpstream([9]));

    const res = await GET({} as any, { params });

    expect(storageAdapter.getSignedUrl).toHaveBeenCalledWith('thumbnails/v1-fallback.jpg');
    expect(res.status).toBe(200);
  });

  it('returns 404 when the upstream object is missing', async () => {
    (uploadService.getVideo as jest.Mock).mockResolvedValue({ id: 'v1', thumbnailStatus: 'ready' });
    (storageAdapter.getSignedUrl as jest.Mock).mockResolvedValue('http://minio:9000/videos/thumbnails/v1.jpg?sig=abc');
    (global as any).fetch.mockResolvedValue({ ok: false, status: 404, headers: { get: () => null } });

    const res = await GET({} as any, { params });

    expect(res.status).toBe(404);
  });
});
