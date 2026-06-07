import { getVideoEventHub } from './videoEventHub';
import { RabbitConsumer } from './rabbitConsumer';

declare global {
  // eslint-disable-next-line no-var
  var __realtimeStarted__: boolean | undefined;
}

export function ensureRealtimeStarted(): void {
  if (globalThis.__realtimeStarted__) {
    return;
  }
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.warn('[realtime] RABBITMQ_URL not set; live updates disabled, UI will rely on the connect snapshot only');
    return;
  }
  globalThis.__realtimeStarted__ = true;
  const consumer = new RabbitConsumer({ url, hub: getVideoEventHub() });
  void consumer.start();
}
