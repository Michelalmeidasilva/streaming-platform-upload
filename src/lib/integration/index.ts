import { IntegrationConfig, IntegrationPayload } from '@/types';
import { IIntegrationConnector } from './IIntegrationConnector';
import { WebhookConnector } from './WebhookConnector';
import { ApiConnector } from './ApiConnector';
import { QueueConnector } from './QueueConnector';
import { EventGatewayConnector } from './EventGatewayConnector';

export class IntegrationLayer {
  private connectors: Map<string, IIntegrationConnector> = new Map();

  register(config: IntegrationConfig): void {
    const connector = this.createConnector(config);
    this.connectors.set(config.name, connector);
  }

  private createConnector(config: IntegrationConfig): IIntegrationConnector {
    switch (config.type) {
      case 'webhook':
        return new WebhookConnector(config);
      case 'api':
        return new ApiConnector(config);
      case 'queue':
        return new QueueConnector(config);
      case 'event-gateway':
        return new EventGatewayConnector(config);
      default:
        throw new Error(`Unknown integration type: ${config.type}`);
    }
  }

  async notify(event: string, videoId: string, data: Record<string, unknown>): Promise<void> {
    const payload: IntegrationPayload = {
      event,
      videoId,
      data,
      timestamp: new Date().toISOString(),
    };

    const promises = Array.from(this.connectors.values()).map(async (connector) => {
      try {
        await connector.send(payload);
      } catch (error) {
        console.error('Integration notification failed:', error);
      }
    });

    await Promise.all(promises);
  }

  async testConnection(name: string): Promise<boolean> {
    const connector = this.connectors.get(name);
    if (!connector) {
      return false;
    }
    return connector.test();
  }

  getConnectors(): string[] {
    return Array.from(this.connectors.keys());
  }

  remove(name: string): void {
    this.connectors.delete(name);
  }
}

export const integrationLayer = new IntegrationLayer();
