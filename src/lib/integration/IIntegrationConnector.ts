import { IntegrationConfig, IntegrationPayload } from '@/types';

export interface IIntegrationConnector {
  send(payload: IntegrationPayload): Promise<boolean>;
  test(): Promise<boolean>;
}

export abstract class BaseIntegrationConnector implements IIntegrationConnector {
  protected config: IntegrationConfig;

  constructor(config: IntegrationConfig) {
    this.config = config;
  }

  abstract send(payload: IntegrationPayload): Promise<boolean>;
  abstract test(): Promise<boolean>;

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }
}
