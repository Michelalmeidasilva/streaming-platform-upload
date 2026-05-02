import { GET as listVideos } from '../route';
import { PATCH as updateVideo, DELETE as deleteVideo } from '../[videoId]/route';
import { GET as downloadVideo } from '../[videoId]/download/route';

jest.mock('@/lib/auth/session', () => ({
  getCurrentSession: jest.fn(),
}));

jest.mock('@/lib/api/uploadService', () => ({
  uploadService: {
    getAllVideos: jest.fn(),
    getVideo: jest.fn(),
    updateVideoTitle: jest.fn(),
    deleteVideo: jest.fn(),
  },
}));

jest.mock('@/lib/security/audit', () => ({
  recordSecurityEvent: jest.fn(),
}));

global.fetch = jest.fn();

const { getCurrentSession } = jest.requireMock('@/lib/auth/session') as {
  getCurrentSession: jest.Mock;
};

const { uploadService } = jest.requireMock('@/lib/api/uploadService') as {
  uploadService: {
    getAllVideos: jest.Mock;
    getVideo: jest.Mock;
    updateVideoTitle: jest.Mock;
    deleteVideo: jest.Mock;
  };
};

describe('video authorization', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns 401 when listing videos without a session', async () => {
    getCurrentSession.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await listVideos(new Request('http://localhost/api/videos') as any);
    expect(response.status).toBe(401);
  });

  it('returns 403 when a MEMBER tries to delete a video', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'member@example.com', role: 'MEMBER' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await deleteVideo(new Request('http://localhost/api/videos/1', { method: 'DELETE' }) as any, {
      params: { videoId: '1' },
    });

    expect(response.status).toBe(403);
  });

  it('allows ADMIN to rename a video', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'admin@example.com', role: 'ADMIN' },
    });

    uploadService.updateVideoTitle.mockReturnValue({
      id: '1',
      title: 'New title',
      originalName: 'Old title',
      size: 10,
      status: 'ready',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      downloadUrl: 'http://storage/video',
    });

    const response = await updateVideo(
      new Request('http://localhost/api/videos/1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'New title' }),
        headers: { 'Content-Type': 'application/json' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
      { params: { videoId: '1' } },
    );

    expect(response.status).toBe(200);
  });

  it('streams authenticated downloads as an attachment', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'member@example.com', role: 'MEMBER' },
    });

    uploadService.getVideo.mockReturnValue({
      id: '1',
      title: 'Video',
      originalName: 'Video',
      size: 10,
      status: 'ready',
      progress: 100,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      url: 'https://storage.example.com/video',
      downloadUrl: '/api/videos/1/download',
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('video'));
          controller.close();
        },
      }),
      headers: new Headers({
        'content-type': 'video/mp4',
        'content-length': '5',
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await downloadVideo(new Request('http://localhost/api/videos/1/download') as any, {
      params: { videoId: '1' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="Video"');
    expect(response.headers.get('content-type')).toBe('video/mp4');
  });
});
