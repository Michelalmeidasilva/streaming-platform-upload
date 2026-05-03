const getCurrentSession = jest.fn();
const canUploadVideo = jest.fn();
const completeUpload = jest.fn();
const recordSecurityEvent = jest.fn();
const notifyIngestStorageCompletion = jest.fn();

jest.mock('@/lib/auth/session', () => ({
  getCurrentSession,
}));

jest.mock('@/lib/auth/permissions', () => ({
  canUploadVideo,
}));

jest.mock('@/lib/api/uploadService', () => ({
  uploadService: {
    completeUpload,
  },
}));

jest.mock('@/lib/security/audit', () => ({
  recordSecurityEvent,
}));

jest.mock('@/lib/integration/storageWebhookBridge', () => ({
  notifyIngestStorageCompletion,
}));

describe('POST /api/upload/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STORAGE_PROVIDER = 's3';
  });

  it('returns unauthorized when there is no session', async () => {
    getCurrentSession.mockResolvedValue(null);
    const { POST } = await import('../route');

    const response = await POST(new Request('http://localhost/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(response.status).toBe(401);
    expect(recordSecurityEvent).toHaveBeenCalled();
  });

  it('notifies ingest after completing an s3 upload', async () => {
    getCurrentSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'admin@example.com' } });
    canUploadVideo.mockReturnValue(true);
    completeUpload.mockResolvedValue({
      id: 'vid-1',
      title: 'video.mp4',
      originalName: 'video.mp4',
      filename: 'vid-1/video.mp4',
      size: 321,
      status: 'processing',
      createdAt: new Date('2026-05-03T17:20:21.655Z'),
      updatedAt: new Date('2026-05-03T17:20:27.030Z'),
      thumbnailUrl: null,
      thumbnailStatus: 'pending',
    });

    const { POST } = await import('../route');

    const response = await POST(new Request('http://localhost/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'session-1',
        etags: [{ PartNumber: 1, ETag: 'etag-1' }],
      }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(response.status).toBe(200);
    expect(notifyIngestStorageCompletion).toHaveBeenCalledWith(
      's3',
      expect.objectContaining({
        key: 'vid-1/video.mp4',
        size: 321,
        multipart: true,
      }),
    );
  });

  it('returns forbidden when the role cannot upload', async () => {
    getCurrentSession.mockResolvedValue({ user: { role: 'MEMBER', email: 'member@example.com' } });
    canUploadVideo.mockReturnValue(false);

    const { POST } = await import('../route');
    const response = await POST(new Request('http://localhost/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(response.status).toBe(403);
    expect(recordSecurityEvent).toHaveBeenCalled();
  });

  it('returns bad request when sessionId is missing', async () => {
    getCurrentSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'admin@example.com' } });
    canUploadVideo.mockReturnValue(true);

    const { POST } = await import('../route');
    const response = await POST(new Request('http://localhost/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(response.status).toBe(400);
  });

  it('maps invalid sessions to status 400', async () => {
    getCurrentSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'admin@example.com' } });
    canUploadVideo.mockReturnValue(true);
    completeUpload.mockRejectedValue(new Error('Invalid session'));

    const { POST } = await import('../route');
    const response = await POST(new Request('http://localhost/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-invalid' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid session' });
  });

  it('skips webhook notification for non-s3 providers', async () => {
    process.env.STORAGE_PROVIDER = 'minio';
    getCurrentSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'admin@example.com' } });
    canUploadVideo.mockReturnValue(true);
    completeUpload.mockResolvedValue({
      id: 'vid-2',
      title: 'video.mp4',
      originalName: 'video.mp4',
      filename: 'vid-2/video.mp4',
      size: 111,
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
      thumbnailUrl: null,
      thumbnailStatus: 'pending',
    });

    const { POST } = await import('../route');

    const response = await POST(new Request('http://localhost/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-2', etags: [] }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(response.status).toBe(200);
    expect(notifyIngestStorageCompletion).not.toHaveBeenCalled();
  });

  it('returns 500 for generic internal errors', async () => {
    getCurrentSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'admin@example.com' } });
    canUploadVideo.mockReturnValue(true);
    completeUpload.mockRejectedValue(new Error('Unexpected database failure'));

    const { POST } = await import('../route');
    const response = await POST(new Request('http://localhost/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Unexpected database failure' });
  });

  it('handles missing etags in the request body', async () => {
    getCurrentSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'admin@example.com' } });
    canUploadVideo.mockReturnValue(true);
    completeUpload.mockResolvedValue({
      id: 'vid-3',
      title: 'video.mp4',
      originalName: 'video.mp4',
      filename: 'vid-3/video.mp4',
      size: 100,
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { POST } = await import('../route');
    await POST(new Request('http://localhost/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-3' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(notifyIngestStorageCompletion).toHaveBeenCalledWith(
      's3',
      expect.objectContaining({ multipart: false }),
    );
  });

  it('defaults to minio when STORAGE_PROVIDER is not set', async () => {
    delete process.env.STORAGE_PROVIDER;
    getCurrentSession.mockResolvedValue({ user: { role: 'ADMIN', email: 'admin@example.com' } });
    canUploadVideo.mockReturnValue(true);
    completeUpload.mockResolvedValue({
      id: 'vid-4',
      title: 'video.mp4',
      originalName: 'video.mp4',
      filename: 'vid-4/video.mp4',
      size: 200,
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { POST } = await import('../route');
    await POST(new Request('http://localhost/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-4' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    // Should not notify ingest because it's not 's3' (it defaulted to 'minio')
    expect(notifyIngestStorageCompletion).not.toHaveBeenCalled();
  });
});
