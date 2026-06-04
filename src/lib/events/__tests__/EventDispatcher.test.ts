/* eslint-disable @typescript-eslint/no-explicit-any */
import { initializeEventDispatcher } from '../EventDispatcher';
import { integrationLayer } from '@/lib/integration';
import { videoEvents } from '@/lib/VideoEventEmitter';

jest.mock('@/lib/integration', () => ({
  integrationLayer: {
    register: jest.fn(),
    notify: jest.fn(),
  },
}));

describe('EventDispatcher', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('initializes and registers gateway if EVENT_GATEWAY_URL env var present', () => {
    process.env.EVENT_GATEWAY_URL = 'http://gateway.com';
    initializeEventDispatcher();
    expect(integrationLayer.register).toHaveBeenCalledWith({
      name: 'EventGateway',
      type: 'streaming-ingest',
      endpoint: 'http://gateway.com',
      enabled: true,
    });
  });

  it('forwards upload.started events to integration layer', () => {
    initializeEventDispatcher();
    const data = { videoId: 'v1', filename: 'test.mp4', size: 1000 };
    videoEvents.emit('upload.started', data);
    expect(integrationLayer.notify).toHaveBeenCalledWith('upload.started', 'v1', data);
  });

  it('forwards upload.progress events to integration layer', () => {
    initializeEventDispatcher();
    const data: any = { videoId: 'v2', filename: 'test.mp4', uploadedBytes: 5000, totalBytes: 10000 };
    videoEvents.emit('upload.progress', data);
    expect(integrationLayer.notify).toHaveBeenCalledWith('upload.progress', 'v2', data);
  });

  it('forwards upload.completed events to integration layer', () => {
    initializeEventDispatcher();
    const data: any = { videoId: 'v3', filename: 'test.mp4' };
    videoEvents.emit('upload.completed', data);
    expect(integrationLayer.notify).toHaveBeenCalledWith('upload.completed', 'v3', data);
  });

  it('forwards upload.failed events to integration layer', () => {
    initializeEventDispatcher();
    const data: any = { videoId: 'v4', filename: 'test.mp4', error: 'Network error' };
    videoEvents.emit('upload.failed', data);
    expect(integrationLayer.notify).toHaveBeenCalledWith('upload.failed', 'v4', data);
  });

  it('forwards video.processing events to integration layer', () => {
    initializeEventDispatcher();
    const data: any = { videoId: 'v5', filename: 'test.mp4' };
    videoEvents.emit('video.processing', data);
    expect(integrationLayer.notify).toHaveBeenCalledWith('video.processing', 'v5', data);
  });

  it('forwards video.ready events to integration layer', () => {
    initializeEventDispatcher();
    const data: any = { videoId: 'v6', filename: 'test.mp4' };
    videoEvents.emit('video.ready', data);
    expect(integrationLayer.notify).toHaveBeenCalledWith('video.ready', 'v6', data);
  });

  it('forwards video.error events to integration layer', () => {
    initializeEventDispatcher();
    const data: any = { videoId: 'v7', filename: 'test.mp4' };
    videoEvents.emit('video.error', data);
    expect(integrationLayer.notify).toHaveBeenCalledWith('video.error', 'v7', data);
  });

  it('extracts unknown videoId when not in data', () => {
    initializeEventDispatcher();
    const data: any = { filename: 'test.mp4' };
    videoEvents.emit('upload.started', data);
    expect(integrationLayer.notify).toHaveBeenCalledWith('upload.started', 'unknown', data);
  });
});
