import { WebhookConnector } from '../WebhookConnector';
import { ApiConnector } from '../ApiConnector';
import { QueueConnector } from '../QueueConnector';
import { EventGatewayConnector } from '../EventGatewayConnector';

describe('Connectors', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const payload = { event: 'upload.started', videoId: 'v1', data: { size: 1024 }, timestamp: '2023-01-01' };

  describe('WebhookConnector', () => {
    it('sends data successfully when enabled', async () => {
      const connector = new WebhookConnector({ name: 'w', type: 'webhook', endpoint: 'http://w.com', enabled: true });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await connector.send(payload);
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('http://w.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });

    it('returns false when disabled', async () => {
      const connector = new WebhookConnector({ name: 'w', type: 'webhook', endpoint: 'http://w.com', enabled: false });
      const result = await connector.send(payload);
      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns false when endpoint is missing', async () => {
      const connector = new WebhookConnector({ name: 'w', type: 'webhook', enabled: true });
      const result = await connector.send(payload);
      expect(result).toBe(false);
    });

    it('returns false on fetch error', async () => {
      const connector = new WebhookConnector({ name: 'w', type: 'webhook', endpoint: 'http://w.com', enabled: true });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await connector.send(payload);
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Webhook send failed:', expect.any(Error));
    });

    it('returns false when response not ok', async () => {
      const connector = new WebhookConnector({ name: 'w', type: 'webhook', endpoint: 'http://w.com', enabled: true });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

      const result = await connector.send(payload);
      expect(result).toBe(false);
    });

    it('sends with authorization header when apiKey provided', async () => {
      const connector = new WebhookConnector({
        name: 'w',
        type: 'webhook',
        endpoint: 'http://w.com',
        enabled: true,
        apiKey: 'secret-key'
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await connector.send(payload);
      expect(global.fetch).toHaveBeenCalledWith('http://w.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer secret-key' },
        body: JSON.stringify(payload),
      });
    });

    it('tests connection successfully', async () => {
      const connector = new WebhookConnector({ name: 'w', type: 'webhook', endpoint: 'http://w.com', enabled: true });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await connector.test();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('http://w.com', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('returns false for test when endpoint missing', async () => {
      const connector = new WebhookConnector({ name: 'w', type: 'webhook', enabled: true });
      const result = await connector.test();
      expect(result).toBe(false);
    });

    it('accepts 405 method not allowed on test', async () => {
      const connector = new WebhookConnector({ name: 'w', type: 'webhook', endpoint: 'http://w.com', enabled: true });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 405 });

      const result = await connector.test();
      expect(result).toBe(true);
    });

    it('returns false on test fetch error', async () => {
      const connector = new WebhookConnector({ name: 'w', type: 'webhook', endpoint: 'http://w.com', enabled: true });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await connector.test();
      expect(result).toBe(false);
    });
  });

  describe('ApiConnector', () => {
    it('sends data to /events endpoint', async () => {
      const connector = new ApiConnector({ name: 'a', type: 'api', endpoint: 'http://a.com', enabled: true });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await connector.send(payload);
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('http://a.com/events', expect.any(Object));
    });

    it('returns false when disabled', async () => {
      const connector = new ApiConnector({ name: 'a', type: 'api', endpoint: 'http://a.com', enabled: false });
      const result = await connector.send(payload);
      expect(result).toBe(false);
    });

    it('returns false when endpoint missing', async () => {
      const connector = new ApiConnector({ name: 'a', type: 'api', enabled: true });
      const result = await connector.send(payload);
      expect(result).toBe(false);
    });

    it('returns false on send error', async () => {
      const connector = new ApiConnector({ name: 'a', type: 'api', endpoint: 'http://a.com', enabled: true });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await connector.send(payload);
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('API connector send failed:', expect.any(Error));
    });

    it('tests /health endpoint', async () => {
      const connector = new ApiConnector({ name: 'a', type: 'api', endpoint: 'http://a.com', enabled: true });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await connector.test();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('http://a.com/health', expect.any(Object));
    });

    it('returns false for test when endpoint missing', async () => {
      const connector = new ApiConnector({ name: 'a', type: 'api', enabled: true });
      const result = await connector.test();
      expect(result).toBe(false);
    });

    it('returns false on test error', async () => {
      const connector = new ApiConnector({ name: 'a', type: 'api', endpoint: 'http://a.com', enabled: true });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Timeout'));

      const result = await connector.test();
      expect(result).toBe(false);
    });

    it('sends with apiKey header', async () => {
      const connector = new ApiConnector({
        name: 'a',
        type: 'api',
        endpoint: 'http://a.com',
        enabled: true,
        apiKey: 'api-key-123'
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await connector.send(payload);
      expect(global.fetch).toHaveBeenCalledWith('http://a.com/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer api-key-123' },
        body: JSON.stringify(payload),
      });
    });
  });

  describe('QueueConnector', () => {
    it('logs message and returns true when enabled', async () => {
      const connector = new QueueConnector({ name: 'q', type: 'queue', endpoint: 'video-queue', enabled: true });

      const result = await connector.send(payload);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        '[QueueConnector] Publishing to queue video-queue:',
        payload
      );
    });

    it('returns false when disabled', async () => {
      const connector = new QueueConnector({ name: 'q', type: 'queue', endpoint: 'video-queue', enabled: false });

      const result = await connector.send(payload);
      expect(result).toBe(false);
    });

    it('uses default queue name when endpoint not provided', async () => {
      const connector = new QueueConnector({ name: 'q', type: 'queue', enabled: true });

      await connector.send(payload);
      expect(console.log).toHaveBeenCalledWith(
        '[QueueConnector] Publishing to queue video-events:',
        payload
      );
    });

    it('tests connection with custom queue name', async () => {
      const connector = new QueueConnector({ name: 'q', type: 'queue', endpoint: 'custom-queue', enabled: true });

      const result = await connector.test();
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith('[QueueConnector] Testing connection to queue custom-queue');
    });

    it('tests connection with default queue name', async () => {
      const connector = new QueueConnector({ name: 'q', type: 'queue', enabled: true });

      await connector.test();
      expect(console.log).toHaveBeenCalledWith('[QueueConnector] Testing connection to queue video-events');
    });
  });

  describe('EventGatewayConnector', () => {
    it('sends transformed payload to /events endpoint', async () => {
      const connector = new EventGatewayConnector({ name: 'g', type: 'event-gateway', endpoint: 'http://g.com', enabled: true });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await connector.send(payload);

      expect(global.fetch).toHaveBeenCalledWith('http://g.com/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'upload.started',
          payload: { videoId: 'v1', size: 1024 }
        }),
      });
    });

    it('returns false when disabled', async () => {
      const connector = new EventGatewayConnector({ name: 'g', type: 'event-gateway', endpoint: 'http://g.com', enabled: false });

      const result = await connector.send(payload);
      expect(result).toBe(false);
    });

    it('returns false when endpoint missing', async () => {
      const connector = new EventGatewayConnector({ name: 'g', type: 'event-gateway', enabled: true });

      const result = await connector.send(payload);
      expect(result).toBe(false);
    });

    it('returns false on send error', async () => {
      const connector = new EventGatewayConnector({ name: 'g', type: 'event-gateway', endpoint: 'http://g.com', enabled: true });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Gateway unreachable'));

      const result = await connector.send(payload);
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('EventGateway connector send failed:', expect.any(Error));
    });

    it('tests /health endpoint', async () => {
      const connector = new EventGatewayConnector({ name: 'g', type: 'event-gateway', endpoint: 'http://g.com', enabled: true });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await connector.test();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('http://g.com/health', expect.any(Object));
    });

    it('returns false for test when endpoint missing', async () => {
      const connector = new EventGatewayConnector({ name: 'g', type: 'event-gateway', enabled: true });

      const result = await connector.test();
      expect(result).toBe(false);
    });

    it('returns false on test error', async () => {
      const connector = new EventGatewayConnector({ name: 'g', type: 'event-gateway', endpoint: 'http://g.com', enabled: true });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const result = await connector.test();
      expect(result).toBe(false);
    });

    it('sends with apiKey header', async () => {
      const connector = new EventGatewayConnector({
        name: 'g',
        type: 'event-gateway',
        endpoint: 'http://g.com',
        enabled: true,
        apiKey: 'gw-key'
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await connector.send(payload);
      expect(global.fetch).toHaveBeenCalledWith('http://g.com/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer gw-key' },
        body: JSON.stringify({
          eventType: 'upload.started',
          payload: { videoId: 'v1', size: 1024 }
        }),
      });
    });

    it('merges payload data into gateway payload', async () => {
      const customPayload = {
        event: 'upload.completed',
        videoId: 'v2',
        data: { duration: 3600, bitrate: 5000 },
        timestamp: '2023-01-02'
      };
      const connector = new EventGatewayConnector({ name: 'g', type: 'event-gateway', endpoint: 'http://g.com', enabled: true });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await connector.send(customPayload);

      expect(global.fetch).toHaveBeenCalledWith('http://g.com/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'upload.completed',
          payload: { videoId: 'v2', duration: 3600, bitrate: 5000 }
        }),
      });
    });
  });
});
