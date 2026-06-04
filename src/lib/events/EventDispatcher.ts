import { integrationLayer } from '@/lib/integration';
import { videoEvents } from '@/lib/VideoEventEmitter';
import { EventData, EventType } from '@/lib/events';

let isInitialized = false;

export function initializeEventDispatcher() {
  if (isInitialized) {
    return;
  }

  isInitialized = true;

  // Register Event Gateway Integration if URL is present
  const eventGatewayUrl = process.env.EVENT_GATEWAY_URL;
  if (eventGatewayUrl) {
    integrationLayer.register({
      name: 'EventGateway',
      type: 'streaming-ingest',
      endpoint: eventGatewayUrl,
      enabled: true,
    });
  }

  // Helper method to forward generic events
  function forwardEvent(type: EventType, data: EventData) {
    const videoId = 'videoId' in data ? data.videoId : 'unknown';
    integrationLayer.notify(type, videoId as string, data as unknown as Record<string, unknown>);
  }

  // Subscribe to all video lifecycle events and forward them
  videoEvents.on('upload.started', (data) => forwardEvent('upload.started', data));
  videoEvents.on('upload.progress', (data) => forwardEvent('upload.progress', data));
  videoEvents.on('upload.completed', (data) => forwardEvent('upload.completed', data));
  videoEvents.on('upload.failed', (data) => forwardEvent('upload.failed', data));
  videoEvents.on('video.processing', (data) => forwardEvent('video.processing', data));
  videoEvents.on('video.ready', (data) => forwardEvent('video.ready', data));
  videoEvents.on('video.error', (data) => forwardEvent('video.error', data));

  console.log('Event Dispatcher initialized, routing video events to integrations.');
}
