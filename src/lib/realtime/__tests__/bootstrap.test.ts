const startMock = jest.fn().mockResolvedValue(undefined);

jest.mock('../rabbitConsumer', () => ({
  RabbitConsumer: jest.fn().mockImplementation(() => ({ start: startMock })),
}));
jest.mock('../videoEventHub', () => ({
  getVideoEventHub: jest.fn().mockReturnValue({ publish: jest.fn() }),
}));

import { RabbitConsumer } from '../rabbitConsumer';

describe('ensureRealtimeStarted', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    (globalThis as { __realtimeStarted__?: boolean }).__realtimeStarted__ = undefined;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('starts the consumer once when RABBITMQ_URL is set', async () => {
    process.env.RABBITMQ_URL = 'amqp://guest:guest@rabbitmq:5672/';
    const { ensureRealtimeStarted } = await import('../bootstrap');

    ensureRealtimeStarted();
    ensureRealtimeStarted();

    expect(RabbitConsumer).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('does not start when RABBITMQ_URL is missing', async () => {
    delete process.env.RABBITMQ_URL;
    const { ensureRealtimeStarted } = await import('../bootstrap');

    ensureRealtimeStarted();

    expect(RabbitConsumer).not.toHaveBeenCalled();
  });
});
