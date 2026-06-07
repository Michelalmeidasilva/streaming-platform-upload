const getAllVideos = jest.fn();
const subscribe = jest.fn().mockReturnValue(() => undefined);
const ensureRealtimeStarted = jest.fn();

jest.mock('@/lib/auth/session', () => ({
  getCurrentSession: jest.fn().mockResolvedValue({ user: { email: 'admin@test' } }),
}));
jest.mock('@/lib/api/uploadService', () => ({ uploadService: { getAllVideos } }));
jest.mock('../../thumbnail', () => ({ deriveThumbnailUrl: async () => null }));
jest.mock('@/lib/realtime/videoEventHub', () => ({
  getVideoEventHub: () => ({ subscribe }),
}));
jest.mock('@/lib/realtime/bootstrap', () => ({ ensureRealtimeStarted }));

import { GET } from '../route';

async function readFirstEvent(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  return new TextDecoder().decode(value);
}

describe('GET /api/videos/stream', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a session', async () => {
    const session = jest.requireMock('@/lib/auth/session');
    session.getCurrentSession.mockResolvedValueOnce(null);
    const res = await GET({} as never);
    expect(res.status).toBe(401);
  });

  it('starts realtime, subscribes to the hub, and sends a snapshot', async () => {
    getAllVideos.mockResolvedValue([
      { id: 'v1', status: 'ready', processingStatus: 'completed', thumbnailStatus: 'ready' },
    ]);

    const res = await GET({} as never);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(ensureRealtimeStarted).toHaveBeenCalledTimes(1);

    const chunk = await readFirstEvent(res.body as ReadableStream<Uint8Array>);
    expect(chunk).toContain('event: video-updated');
    expect(chunk).toContain('"id":"v1"');
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('emits null for undefined optional video fields in snapshot', async () => {
    getAllVideos.mockResolvedValue([{ id: 'v2', status: 'uploading' }]);

    const res = await GET({} as never);
    const chunk = await readFirstEvent(res.body as ReadableStream<Uint8Array>);
    expect(chunk).toContain('"processingStatus":null');
    expect(chunk).toContain('"thumbnailStatus":null');
    expect(chunk).toContain('"storageConfirmedAt":null');
  });

  it('keeps the stream open when getAllVideos throws (best-effort snapshot)', async () => {
    getAllVideos.mockRejectedValue(new Error('DB error'));

    const res = await GET({} as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    // subscribe still called after catch
    expect(subscribe).toHaveBeenCalledTimes(1);
    await res.body!.cancel();
  });

  it('calls unsubscribe when the stream is cancelled', async () => {
    const unsubscribeFn = jest.fn();
    subscribe.mockReturnValueOnce(unsubscribeFn);
    getAllVideos.mockResolvedValue([]);

    const res = await GET({} as never);
    // drain the snapshot (empty) so start() completes and unsubscribe is set
    const reader = res.body!.getReader();
    await reader.cancel();
    expect(unsubscribeFn).toHaveBeenCalled();
  });
});
