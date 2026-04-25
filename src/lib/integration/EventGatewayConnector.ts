import { BaseIntegrationConnector } from './IIntegrationConnector';
import { IntegrationPayload } from '@/types';

export class EventGatewayConnector extends BaseIntegrationConnector {
  async send(payload: IntegrationPayload): Promise<boolean> {
    if (!this.config.enabled || !this.config.endpoint) {
      return false;
    }

    try {
      // Event Gateway specific payload mapping according to INTEGRATION_GUIDE.md
      const gatewayPayload = {
        eventType: payload.event,
        payload: {
          videoId: payload.videoId,
          ...payload.data
        }
      };

      const response = await fetch(`${this.config.endpoint}/events`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(gatewayPayload),
      });

      return response.ok;
    } catch (error) {
      console.error('EventGateway connector send failed:', error);
      return false;
    }
  }

  async test(): Promise<boolean> {
    if (!this.config.endpoint) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
