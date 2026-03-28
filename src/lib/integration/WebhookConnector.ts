import { BaseIntegrationConnector } from './IIntegrationConnector';
import { IntegrationConfig, IntegrationPayload } from '@/types';

export class WebhookConnector extends BaseIntegrationConnector {
  constructor(config: IntegrationConfig) {
    super(config);
  }

  async send(payload: IntegrationPayload): Promise<boolean> {
    if (!this.config.enabled || !this.config.endpoint) {
      return false;
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      console.error('Webhook send failed:', error);
      return false;
    }
  }

  async test(): Promise<boolean> {
    if (!this.config.endpoint) {
      return false;
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return response.ok || response.status === 405;
    } catch {
      return false;
    }
  }
}
