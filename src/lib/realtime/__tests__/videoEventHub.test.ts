// Mock the app-level deps that getVideoEventHub wires, so importing this module
// does not pull in the heavy uploadService singleton and so the singleton test
// can assert the wiring. The direct-construction tests below ignore these mocks.
jest.mock('@/lib/api/uploadService', () => ({
  uploadService: { getVideo: jest.fn() },
}));
jest.mock('@/app/api/videos/thumbnail', () => ({
  deriveThumbnailUrl: jest.fn(async () => null),
}));

import { VideoEventHub, getVideoEventHub } from '../videoEventHub';
import type { Video } from '@/types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function videoFixture(overrides: Partial<Video> = {}): Video {
  return {
    id: 'v1',
    filename: 'v1/video.mp4',
    originalName: 'video.mp4',
    title: 'video.mp4',
    size: 10,
    status: 'ready',
    ...overrides,
  } as Video;
}

describe('VideoEventHub', () => {
  beforeEach(() => {
    (globalThis as { __videoEventHub__?: unknown }).__videoEventHub__ = undefined;
  });

  it('coalesces multiple publishes for the same id into one fetch', async () => {
    const fetchVideo = jest.fn().mockResolvedValue(videoFixture());
    const hub = new VideoEventHub({
      fetchVideo,
      deriveThumbnailUrl: async () => null,
      debounceMs: 10,
    });

    hub.publish('v1');
    hub.publish('v1');
    hub.publish('v1');
    await wait(30);

    expect(fetchVideo).toHaveBeenCalledTimes(1);
    expect(fetchVideo).toHaveBeenCalledWith('v1');
  });

  it('broadcasts the derived payload to every subscriber', async () => {
    const hub = new VideoEventHub({
      fetchVideo: async () =>
        videoFixture({ status: 'ready', processingStatus: 'completed' as Video['processingStatus'], thumbnailStatus: 'ready', storageConfirmedAt: '2026-01-01T00:00:00Z' }),
      deriveThumbnailUrl: async (v) => `/api/videos/${v.id}/thumbnail`,
      debounceMs: 5,
    });
    const a = jest.fn();
    const b = jest.fn();
    hub.subscribe(a);
    hub.subscribe(b);

    hub.publish('v1');
    await wait(20);

    const expected = {
      id: 'v1',
      status: 'ready',
      processingStatus: 'completed',
      thumbnailStatus: 'ready',
      storageConfirmedAt: '2026-01-01T00:00:00Z',
      thumbnailUrl: '/api/videos/v1/thumbnail',
    };
    expect(a).toHaveBeenCalledWith(expected);
    expect(b).toHaveBeenCalledWith(expected);
  });

  it('stops delivering after unsubscribe', async () => {
    const hub = new VideoEventHub({
      fetchVideo: async () => videoFixture(),
      deriveThumbnailUrl: async () => null,
      debounceMs: 5,
    });
    const handler = jest.fn();
    const unsubscribe = hub.subscribe(handler);
    unsubscribe();

    hub.publish('v1');
    await wait(20);

    expect(handler).not.toHaveBeenCalled();
  });

  it('skips broadcast when the video is not found', async () => {
    const hub = new VideoEventHub({
      fetchVideo: async () => undefined,
      deriveThumbnailUrl: async () => null,
      debounceMs: 5,
    });
    const handler = jest.fn();
    hub.subscribe(handler);

    hub.publish('missing');
    await wait(20);

    expect(handler).not.toHaveBeenCalled();
  });

  it('swallows fetch errors without throwing or broadcasting', async () => {
    const hub = new VideoEventHub({
      fetchVideo: async () => {
        throw new Error('ingest down');
      },
      deriveThumbnailUrl: async () => null,
      debounceMs: 5,
    });
    const handler = jest.fn();
    hub.subscribe(handler);

    expect(() => hub.publish('v1')).not.toThrow();
    await wait(20);

    expect(handler).not.toHaveBeenCalled();
  });

  it('getVideoEventHub returns a process singleton wired to uploadService', async () => {
    const { uploadService } = jest.requireMock('@/lib/api/uploadService');
    (uploadService.getVideo as jest.Mock).mockResolvedValue(videoFixture());

    const hub1 = getVideoEventHub();
    const hub2 = getVideoEventHub();
    expect(hub1).toBe(hub2);

    const handler = jest.fn();
    hub1.subscribe(handler);
    hub1.publish('v1');
    await wait(300); // default 250ms debounce

    expect(uploadService.getVideo).toHaveBeenCalledWith('v1');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
