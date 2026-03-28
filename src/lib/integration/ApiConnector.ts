import { BaseIntegrationConnector } from './IIntegrationConnector';
import { IntegrationPayload } from '@/types';

export class ApiConnector extends BaseIntegrationConnector {
  async send(payload: IntegrationPayload): Promise<boolean> {
    if (!this.config.enabled || !this.config.endpoint) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.endpoint}/events`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      console.error('API connector send failed:', error);
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
