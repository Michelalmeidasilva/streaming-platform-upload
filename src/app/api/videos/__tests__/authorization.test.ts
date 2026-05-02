import { GET as listVideos } from '../route';
import { GET as getVideo, PATCH as updateVideo, DELETE as deleteVideo } from '../[videoId]/route';
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

  it('lists all videos when search query is empty', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'admin@example.com', role: 'ADMIN' },
    });

    uploadService.getAllVideos.mockReturnValue([
      {
        id: '1',
        filename: 'video1.mp4',
        originalName: 'video1.mp4',
        title: 'First Video',
        size: 1024,
        status: 'ready',
        progress: 100,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: '2',
        filename: 'video2.mp4',
        originalName: 'video2.mp4',
        title: 'Second Video',
        size: 2048,
        status: 'ready',
        progress: 100,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await listVideos(new Request('http://localhost/api/videos') as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.videos).toHaveLength(2);
    expect(data.videos[0].title).toBe('First Video');
    expect(data.videos[1].title).toBe('Second Video');
  });

  it('filters videos by title in search query', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'admin@example.com', role: 'ADMIN' },
    });

    uploadService.getAllVideos.mockReturnValue([
      {
        id: '1',
        filename: 'video1.mp4',
        originalName: 'video1.mp4',
        title: 'First Video',
        size: 1024,
        status: 'ready',
        progress: 100,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: '2',
        filename: 'video2.mp4',
        originalName: 'video2.mp4',
        title: 'Second Video',
        size: 2048,
        status: 'ready',
        progress: 100,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await listVideos(new Request('http://localhost/api/videos?q=first') as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.videos).toHaveLength(1);
    expect(data.videos[0].title).toBe('First Video');
  });

  it('filters videos by originalName in search query', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'member@example.com', role: 'MEMBER' },
    });

    uploadService.getAllVideos.mockReturnValue([
      {
        id: '1',
        filename: 'video1.mp4',
        originalName: 'production.mp4',
        title: 'First Video',
        size: 1024,
        status: 'ready',
        progress: 100,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: '2',
        filename: 'video2.mp4',
        originalName: 'demo.mp4',
        title: 'Second Video',
        size: 2048,
        status: 'ready',
        progress: 100,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await listVideos(new Request('http://localhost/api/videos?q=production') as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.videos).toHaveLength(1);
    expect(data.videos[0].originalName).toBe('production.mp4');
  });

  it('performs case-insensitive search on videos', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'admin@example.com', role: 'ADMIN' },
    });

    uploadService.getAllVideos.mockReturnValue([
      {
        id: '1',
        filename: 'video1.mp4',
        originalName: 'Video.mp4',
        title: 'My Video Content',
        size: 1024,
        status: 'ready',
        progress: 100,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await listVideos(new Request('http://localhost/api/videos?q=CONTENT') as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.videos).toHaveLength(1);
    expect(data.videos[0].title).toBe('My Video Content');
  });

  it('trims whitespace from search query', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'admin@example.com', role: 'ADMIN' },
    });

    uploadService.getAllVideos.mockReturnValue([
      {
        id: '1',
        filename: 'video1.mp4',
        originalName: 'video1.mp4',
        title: 'Tutorial',
        size: 1024,
        status: 'ready',
        progress: 100,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await listVideos(new Request('http://localhost/api/videos?q=%20%20tutorial%20%20') as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.videos).toHaveLength(1);
    expect(data.videos[0].title).toBe('Tutorial');
  });

  it('returns empty array when search has no matches', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'member@example.com', role: 'MEMBER' },
    });

    uploadService.getAllVideos.mockReturnValue([
      {
        id: '1',
        filename: 'video1.mp4',
        originalName: 'video1.mp4',
        title: 'First Video',
        size: 1024,
        status: 'ready',
        progress: 100,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await listVideos(new Request('http://localhost/api/videos?q=nonexistent') as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.videos).toHaveLength(0);
  });

  it('returns 403 when role without search permission attempts to list videos', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'guest@example.com', role: 'GUEST' },
    });

    uploadService.getAllVideos.mockReturnValue([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await listVideos(new Request('http://localhost/api/videos') as any);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
  });

  it('returns 403 when a MEMBER tries to update a video', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'member@example.com', role: 'MEMBER' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await updateVideo(
      new Request('http://localhost/api/videos/1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated title' }),
        headers: { 'Content-Type': 'application/json' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
      { params: { videoId: '1' } },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
  });

  it('returns 401 when deleting a video without a session', async () => {
    getCurrentSession.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await deleteVideo(new Request('http://localhost/api/videos/1', { method: 'DELETE' }) as any, {
      params: { videoId: '1' },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('allows ADMIN to delete a video', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'admin@example.com', role: 'ADMIN' },
    });

    uploadService.getVideo.mockReturnValue({
      id: '1',
      title: 'Video to delete',
      originalName: 'video.mp4',
      size: 1024,
      status: 'ready',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    uploadService.deleteVideo.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await deleteVideo(new Request('http://localhost/api/videos/1', { method: 'DELETE' }) as any, {
      params: { videoId: '1' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(uploadService.deleteVideo).toHaveBeenCalledWith('1');
  });

  it('returns video details when video is found', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'member@example.com', role: 'MEMBER' },
    });

    uploadService.getVideo.mockReturnValue({
      id: '1',
      title: 'Test Video',
      originalName: 'test.mp4',
      size: 2048,
      status: 'ready',
      thumbnailUrl: 'http://storage/thumbnail.jpg',
      thumbnailStatus: 'ready',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await getVideo(new Request('http://localhost/api/videos/1') as any, {
      params: { videoId: '1' },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.video).toEqual({
      id: '1',
      title: 'Test Video',
      originalName: 'test.mp4',
      size: 2048,
      status: 'ready',
      downloadUrl: '/api/videos/1/download',
      thumbnailUrl: 'http://storage/thumbnail.jpg',
      thumbnailStatus: 'ready',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('returns 404 when video is not found', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'member@example.com', role: 'MEMBER' },
    });

    uploadService.getVideo.mockReturnValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await getVideo(new Request('http://localhost/api/videos/nonexistent') as any, {
      params: { videoId: 'nonexistent' },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Video not found' });
  });

  it('returns 401 when updating a video without a session', async () => {
    getCurrentSession.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await updateVideo(
      new Request('http://localhost/api/videos/1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated title' }),
        headers: { 'Content-Type': 'application/json' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
      { params: { videoId: '1' } },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when updating a video with empty title', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'admin@example.com', role: 'ADMIN' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await updateVideo(
      new Request('http://localhost/api/videos/1', {
        method: 'PATCH',
        body: JSON.stringify({ title: '   ' }),
        headers: { 'Content-Type': 'application/json' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
      { params: { videoId: '1' } },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'title is required' });
  });

  it('returns 404 when updating a video that does not exist', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'admin@example.com', role: 'ADMIN' },
    });

    uploadService.updateVideoTitle.mockReturnValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await updateVideo(
      new Request('http://localhost/api/videos/nonexistent', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'New title' }),
        headers: { 'Content-Type': 'application/json' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
      { params: { videoId: 'nonexistent' } },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Video not found' });
  });

  it('returns 404 when deleting a video that does not exist', async () => {
    getCurrentSession.mockResolvedValue({
      user: { email: 'admin@example.com', role: 'ADMIN' },
    });

    uploadService.getVideo.mockReturnValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await deleteVideo(new Request('http://localhost/api/videos/nonexistent', { method: 'DELETE' }) as any, {
      params: { videoId: 'nonexistent' },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Video not found' });
  });
});
