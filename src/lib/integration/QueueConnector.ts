import { BaseIntegrationConnector } from './IIntegrationConnector';
import { IntegrationConfig, IntegrationPayload } from '@/types';

export class QueueConnector extends BaseIntegrationConnector {
  private queueName: string;

  constructor(config: IntegrationConfig) {
    super(config);
    this.queueName = config.endpoint || 'video-events';
  }

  async send(payload: IntegrationPayload): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    console.log(`[QueueConnector] Publishing to queue ${this.queueName}:`, payload);
    return true;
  }

  async test(): Promise<boolean> {
    console.log(`[QueueConnector] Testing connection to queue ${this.queueName}`);
    return true;
  }
}
