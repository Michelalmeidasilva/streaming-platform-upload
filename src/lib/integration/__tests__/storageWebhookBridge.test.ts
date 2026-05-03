describe('storageWebhookBridge', () => {
  const originalEnv = process.env;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('skips notification when no webhook base url is configured', async () => {
    delete process.env.INGEST_STORAGE_WEBHOOK_BASE_URL;
    delete process.env.EVENT_GATEWAY_URL;

    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');
    await notifyIngestStorageCompletion('s3', { key: 'video.mp4', size: 100 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts an aws-s3 compatible payload for s3 uploads', async () => {
    process.env.INGEST_STORAGE_WEBHOOK_BASE_URL = 'http://localhost:8080/api/v1/';
    fetchMock.mockResolvedValue({ ok: true });

    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');
    await notifyIngestStorageCompletion('s3', {
      key: 'vid-1/video.mp4',
      size: 123,
      multipart: true,
      occurredAt: new Date('2026-05-03T17:20:26.000Z'),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/webhooks/storage/aws-s3',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      Records: [
        {
          eventName: 'ObjectCreated:CompleteMultipartUpload',
          eventTime: '2026-05-03T17:20:26.000Z',
          s3: {
            object: {
              key: 'vid-1/video.mp4',
              size: 123,
            },
          },
        },
      ],
    });
  });

  it('posts a minio compatible payload for minio uploads', async () => {
    process.env.INGEST_STORAGE_WEBHOOK_BASE_URL = 'http://localhost:8080/api/v1';
    fetchMock.mockResolvedValue({ ok: true });

    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');
    await notifyIngestStorageCompletion('minio', {
      key: 'vid-1/video.mp4',
      size: 123,
      multipart: false,
      occurredAt: new Date('2026-05-03T17:20:26.000Z'),
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      EventName: 's3:ObjectCreated:Put',
      Key: 'vid-1/video.mp4',
      Records: [
        {
          eventTime: '2026-05-03T17:20:26.000Z',
          s3: {
            object: {
              key: 'vid-1/video.mp4',
              size: 123,
            },
          },
        },
      ],
    });
  });

  it('ignores unsupported provider values', async () => {
    process.env.INGEST_STORAGE_WEBHOOK_BASE_URL = 'http://localhost:8080/api/v1';

    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');
    await notifyIngestStorageCompletion('unknown' as never, { key: 'video.mp4', size: 1 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the ingest webhook rejects the notification', async () => {
    process.env.EVENT_GATEWAY_URL = 'http://localhost:8080/api/v1/events';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('boom'),
    });

    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');

    await expect(
      notifyIngestStorageCompletion('s3', { key: 'vid-1/video.mp4', size: 123 }),
    ).rejects.toThrow('Failed to notify ingest storage webhook (500): boom');
  });

  it('posts an aws-s3 compatible payload for s3 uploads (non-multipart)', async () => {
    process.env.INGEST_STORAGE_WEBHOOK_BASE_URL = 'http://localhost:8080/api/v1/';
    fetchMock.mockResolvedValue({ ok: true });

    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');
    await notifyIngestStorageCompletion('s3', {
      key: 'vid-1/video.mp4',
      size: 123,
      multipart: false,
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.Records[0].eventName).toBe('ObjectCreated:Put');
    expect(body.Records[0].eventTime).toBeDefined();
  });

  it('posts a minio compatible payload for minio uploads (multipart)', async () => {
    process.env.INGEST_STORAGE_WEBHOOK_BASE_URL = 'http://localhost:8080/api/v1';
    fetchMock.mockResolvedValue({ ok: true });

    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');
    await notifyIngestStorageCompletion('minio', {
      key: 'vid-1/video.mp4',
      size: 123,
      multipart: true,
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.EventName).toBe('s3:ObjectCreated:CompleteMultipartUpload');
    expect(body.Records[0].eventTime).toBeDefined();
  });

  it('skips notification for memory provider', async () => {
    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');
    await notifyIngestStorageCompletion('memory', { key: 'video.mp4', size: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles response.text() failure', async () => {
    process.env.INGEST_STORAGE_WEBHOOK_BASE_URL = 'http://localhost:8080/api/v1';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockRejectedValue(new Error('cannot read text')),
    });

    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');
    await expect(
      notifyIngestStorageCompletion('s3', { key: 'video.mp4', size: 123 }),
    ).rejects.toThrow('Failed to notify ingest storage webhook (500): ');
  });

  it('skips notification when INGEST_STORAGE_WEBHOOK_BASE_URL is only whitespace', async () => {
    process.env.INGEST_STORAGE_WEBHOOK_BASE_URL = '   ';
    delete process.env.EVENT_GATEWAY_URL;

    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');
    await notifyIngestStorageCompletion('s3', { key: 'video.mp4', size: 100 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips notification when EVENT_GATEWAY_URL is only whitespace', async () => {
    delete process.env.INGEST_STORAGE_WEBHOOK_BASE_URL;
    process.env.EVENT_GATEWAY_URL = '   ';

    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');
    await notifyIngestStorageCompletion('s3', { key: 'video.mp4', size: 100 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('correctly formats EVENT_GATEWAY_URL with trailing slash and no /events suffix', async () => {
    delete process.env.INGEST_STORAGE_WEBHOOK_BASE_URL;
    process.env.EVENT_GATEWAY_URL = 'http://gateway.internal/';
    fetchMock.mockResolvedValue({ ok: true });

    const { notifyIngestStorageCompletion } = await import('../storageWebhookBridge');
    await notifyIngestStorageCompletion('s3', { key: 'video.mp4', size: 100 });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://gateway.internal/webhooks/storage/aws-s3',
      expect.anything(),
    );
  });
});
