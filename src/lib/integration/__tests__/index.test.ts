/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationLayer } from '../index';
import { IntegrationConfig } from '@/types';

describe('IntegrationLayer', () => {
  let layer: IntegrationLayer;

  beforeEach(() => {
    layer = new IntegrationLayer();
  });

  it('registers and removes connectors', () => {
    const config: IntegrationConfig = { name: 'test', type: 'webhook', endpoint: 'http://test.com', enabled: true };
    layer.register(config);
    expect(layer.getConnectors()).toContain('test');

    layer.remove('test');
    expect(layer.getConnectors()).not.toContain('test');
  });

  it('notifies all connectors', async () => {
    const config1: IntegrationConfig = { name: 'c1', type: 'webhook', endpoint: 'http://c1.com', enabled: true };
    const config2: IntegrationConfig = { name: 'c2', type: 'webhook', endpoint: 'http://c2.com', enabled: true };
    layer.register(config1);
    layer.register(config2);

    const connectors = (layer as any).connectors;
    const sendSpy1 = jest.spyOn(connectors.get('c1'), 'send').mockResolvedValue(true);
    const sendSpy2 = jest.spyOn(connectors.get('c2'), 'send').mockResolvedValue(true);

    await layer.notify('upload', 'v1', { foo: 'bar' });

    expect(sendSpy1).toHaveBeenCalled();
    expect(sendSpy2).toHaveBeenCalled();
  });

  it('handles notification errors gracefully', async () => {
    const config: IntegrationConfig = { name: 'c1', type: 'webhook', endpoint: 'http://c1.com', enabled: true };
    layer.register(config);

    const connectors = (layer as any).connectors;
    jest.spyOn(connectors.get('c1'), 'send').mockRejectedValue(new Error('Fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await layer.notify('upload', 'v1', {});

    expect(consoleSpy).toHaveBeenCalledWith('Integration notification failed:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('tests connection correctly', async () => {
    const config: IntegrationConfig = { name: 'test', type: 'webhook', endpoint: 'http://test.com', enabled: true };
    layer.register(config);

    const connectors = (layer as any).connectors;
    jest.spyOn(connectors.get('test'), 'test').mockResolvedValue(true);

    const result = await layer.testConnection('test');
    expect(result).toBe(true);

    expect(await layer.testConnection('non-existent')).toBe(false);
  });

  it('throws error for unknown connector type', () => {
    const config = { name: 'test', type: 'invalid' } as any;
    expect(() => layer.register(config)).toThrow('Unknown integration type: invalid');
  });

  it('creates WebhookConnector for webhook type', () => {
    const config: IntegrationConfig = { name: 'wh', type: 'webhook', endpoint: 'http://webhook.com', enabled: true };
    layer.register(config);
    expect(layer.getConnectors()).toContain('wh');
  });

  it('creates ApiConnector for api type', () => {
    const config: IntegrationConfig = { name: 'api', type: 'api', endpoint: 'http://api.com', enabled: true };
    layer.register(config);
    expect(layer.getConnectors()).toContain('api');
  });

  it('creates QueueConnector for queue type', () => {
    const config: IntegrationConfig = { name: 'q', type: 'queue', endpoint: 'video-queue', enabled: true };
    layer.register(config);
    expect(layer.getConnectors()).toContain('q');
  });

  it('creates EventGatewayConnector for event-gateway type', () => {
    const config: IntegrationConfig = { name: 'eg', type: 'event-gateway', endpoint: 'http://gateway.com', enabled: true };
    layer.register(config);
    expect(layer.getConnectors()).toContain('eg');
  });

  it('notifies with correct payload structure', async () => {
    const config: IntegrationConfig = { name: 'c', type: 'webhook', endpoint: 'http://test.com', enabled: true };
    layer.register(config);

    const connectors = (layer as any).connectors;
    const sendSpy = jest.spyOn(connectors.get('c'), 'send').mockResolvedValue(true);

    await layer.notify('video.ready', 'vid-123', { duration: 3600 });

    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({
      event: 'video.ready',
      videoId: 'vid-123',
      data: { duration: 3600 },
      timestamp: expect.any(String),
    }));
  });
});
