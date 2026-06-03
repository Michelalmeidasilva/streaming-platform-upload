import { IngestUploadStateClient } from '../IngestUploadStateClient';

describe('IngestUploadStateClient', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('normalizes the configured base url and saves state', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));
    const client = new IngestUploadStateClient('http://ingest.local/api/v1/');

    await client.saveState({
      session: {
        id: 's1',
        videoId: 'v1',
        totalChunks: 1,
        uploadedChunks: 0,
        chunkSize: 10,
        totalSize: 10,
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        filename: 'video.mp4',
        uploadId: '',
        etags: [],
      },
      video: {
        id: 'v1',
        filename: 'v1/video.mp4',
        originalName: 'video.mp4',
        title: 'video.mp4',
        size: 10,
        status: 'uploading',
        progress: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://ingest.local/api/v1/upload-state/sessions/s1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('maps persisted state and videos from the ingest API', async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session: {
          id: 's1',
          videoId: 'v1',
          totalChunks: 2,
          uploadedChunks: 1,
          chunkSize: 10,
          totalSize: 20,
          startedAt: '2026-01-01T00:00:00.000Z',
          filename: 'video.mp4',
          uploadId: 'u1',
          etags: [{ PartNumber: 1, ETag: 'etag-1' }],
        },
        video: {
          id: 'v1',
          filename: 'v1/video.mp4',
          originalName: 'video.mp4',
          title: 'Title',
          size: 20,
          status: 'processing',
          progress: 50,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
          downloadUrl: 'http://storage/file',
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        video: {
          id: 'v1',
          filename: 'v1/video.mp4',
          originalName: 'video.mp4',
          title: 'Title',
          size: 20,
          status: 'ready',
          progress: 100,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        videos: [{
          id: 'v1',
          filename: 'v1/video.mp4',
          originalName: 'video.mp4',
          title: 'Title',
          size: 20,
          status: 'ready',
          progress: 100,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        }],
      }), { status: 200 }));

    const client = new IngestUploadStateClient('http://ingest.local/api/v1');
    const state = await client.getState('s1');
    const video = await client.getVideo('v1');
    const videos = await client.listVideos('title');

    expect(state?.session.startedAt).toBeInstanceOf(Date);
    expect(state?.video.downloadUrl).toBe('http://storage/file');
    expect(video?.status).toBe('ready');
    expect(videos).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      3,
      'http://ingest.local/api/v1/upload-state/videos?q=title',
      expect.any(Object),
    );
  });

  it('returns null on 404 responses', async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const client = new IngestUploadStateClient();

    await expect(client.getState('missing')).resolves.toBeNull();
    await expect(client.getVideo('missing')).resolves.toBeNull();
    await expect(client.updateVideo('missing', { title: 'x' })).resolves.toBeNull();
  });

  it('patches and deletes videos and sessions', async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        video: {
          id: 'v1',
          filename: 'v1/video.mp4',
          originalName: 'video.mp4',
          title: 'Updated',
          size: 20,
          status: 'ready',
          progress: 100,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new IngestUploadStateClient('http://ingest.local/api/v1');
    const updated = await client.updateVideo('v1', { title: 'Updated' });
    await client.deleteVideo('v1');
    await client.deleteSession('s1');

    expect(updated?.title).toBe('Updated');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      'http://ingest.local/api/v1/upload-state/videos/v1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('prefers API error payloads and falls back to status text', async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'broken' }), { status: 500, statusText: 'Internal Server Error' }))
      .mockResolvedValueOnce(new Response('no-json', { status: 503, statusText: 'Unavailable' }));

    const client = new IngestUploadStateClient('http://ingest.local/api/v1');

    await expect(client.saveVideo({
      id: 'v1',
      filename: 'v1/video.mp4',
      originalName: 'video.mp4',
      title: 'video.mp4',
      size: 10,
      status: 'uploading',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })).rejects.toThrow('broken');

    await expect(client.listVideos()).rejects.toThrow('503 Unavailable');
  });

  it('returns an empty list when the response body has no videos array', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const client = new IngestUploadStateClient('http://ingest.local/api/v1');

    await expect(client.listVideos()).resolves.toEqual([]);
  });

  it('maps default field values when ingest omits optional properties', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({
      video: {
        id: 'v1',
        filename: 'v1/video.mp4',
        originalName: '',
        title: '',
        size: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: undefined,
      },
    }), { status: 200 }));
    const client = new IngestUploadStateClient('http://ingest.local/api/v1');

    const video = await client.getVideo('v1');

    expect(video?.status).toBe('uploading');
    expect(video?.progress).toBe(0);
    expect(video?.updatedAt).toBeInstanceOf(Date);
  });

  it('uses environment fallback base urls and preserves Date instances returned by fetch mocks', async () => {
    process.env.INGEST_PERSISTENCE_BASE_URL = 'http://env-ingest/api/v1/';
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        video: {
          id: '',
          filename: '',
          originalName: '',
          title: '',
          size: 0,
          status: undefined,
          progress: undefined,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          url: undefined,
          thumbnailUrl: undefined,
          thumbnailStatus: undefined,
          mimeType: undefined,
        },
      }),
    });

    const client = new IngestUploadStateClient();
    const video = await client.getVideo('v1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://env-ingest/api/v1/upload-state/videos/v1',
      expect.any(Object),
    );
    expect(video?.createdAt).toBeInstanceOf(Date);
    expect(video?.status).toBe('uploading');
  });

  it('keeps default status text when error payload has no error field', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({ message: 'ignored' }), {
      status: 502,
      statusText: 'Bad Gateway',
    }));
    const client = new IngestUploadStateClient('http://ingest.local/api/v1');

    await expect(client.deleteSession('s1')).rejects.toThrow('502 Bad Gateway');
  });

  it('maps all optional string fields in mapVideo when they are present', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({
      video: {
        id: 'v1',
        filename: 'v1/video.mp4',
        originalName: 'video.mp4',
        title: 'My Video',
        size: 100,
        status: 'ready',
        progress: 100,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        url: 'http://cdn/video.mp4',
        downloadUrl: 'http://cdn/download',
        thumbnailUrl: 'http://cdn/thumb.jpg',
        thumbnailStatus: 'ready',
        mimeType: 'video/mp4',
        processingStatus: 'done',
        source: { provider: 'minio', bucket: 'videos', key: 'v1' },
        mediaInfo: { duration: 120 },
        transcode: { status: 'done' },
        playback: { dashUrl: 'http://cdn/manifest.mpd' },
        metrics: { views: 42 },
      },
    }), { status: 200 }));

    const client = new IngestUploadStateClient('http://ingest.local/api/v1');
    const video = await client.getVideo('v1');

    expect(video?.url).toBe('http://cdn/video.mp4');
    expect(video?.downloadUrl).toBe('http://cdn/download');
    expect(video?.thumbnailUrl).toBe('http://cdn/thumb.jpg');
    expect(video?.thumbnailStatus).toBe('ready');
    expect(video?.mimeType).toBe('video/mp4');
    expect(video?.processingStatus).toBe('done');
    expect(video?.source).toEqual({ provider: 'minio', bucket: 'videos', key: 'v1' });
    expect(video?.mediaInfo).toEqual({ duration: 120 });
    expect(video?.transcode).toEqual({ status: 'done' });
    expect(video?.playback).toEqual({ dashUrl: 'http://cdn/manifest.mpd' });
    expect(video?.metrics).toEqual({ views: 42 });
  });

  it('asString returns empty string for non-string values', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({
      video: {
        id: 42,
        filename: null,
        originalName: undefined,
        title: 123,
        size: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    }), { status: 200 }));

    const client = new IngestUploadStateClient('http://ingest.local/api/v1');
    const video = await client.getVideo('v1');

    expect(video?.id).toBe('');
    expect(video?.filename).toBe('');
  });

  it('uses EVENT_GATEWAY_URL env fallback when INGEST_PERSISTENCE_BASE_URL is unset', async () => {
    delete process.env.INGEST_PERSISTENCE_BASE_URL;
    process.env.EVENT_GATEWAY_URL = 'http://gateway/api/v1';
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 404 }));

    const client = new IngestUploadStateClient();
    await client.getVideo('v1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://gateway/api/v1/upload-state/videos/v1',
      expect.any(Object),
    );
    delete process.env.EVENT_GATEWAY_URL;
  });
});
