import {
  extractVideoId,
  RabbitConsumer,
  type AmqpConnectionLike,
  type AmqpChannelLike,
  type AmqpMessageLike,
} from '../rabbitConsumer';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('extractVideoId', () => {
  it.each([
    [{ videoId: 'a' }, 'a'],
    [{ video_id: 'b' }, 'b'],
    [{ video: { id: 'c' } }, 'c'],
    [{ id: 'd' }, 'd'],
  ])('reads the id from %p', (body, expected) => {
    expect(extractVideoId(Buffer.from(JSON.stringify(body)))).toBe(expected);
  });

  it('returns null for non-JSON or id-less payloads', () => {
    expect(extractVideoId(Buffer.from('not json'))).toBeNull();
    expect(extractVideoId(Buffer.from(JSON.stringify({ foo: 1 })))).toBeNull();
  });
});

interface FakeChannel extends AmqpChannelLike {
  deliver: (body: unknown) => void;
}

function makeFakeConnection(): {
  conn: AmqpConnectionLike;
  channel: FakeChannel;
  triggerClose: () => void;
  acked: AmqpMessageLike[];
} {
  const acked: AmqpMessageLike[] = [];
  let onMessage: ((msg: AmqpMessageLike | null) => void) | undefined;
  let closeCb: (() => void) | undefined;

  const channel: FakeChannel = {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue({ queue: 'q-test' }),
    bindQueue: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockImplementation((_q, handler) => {
      onMessage = handler;
      return Promise.resolve(undefined);
    }),
    ack: jest.fn().mockImplementation((msg: AmqpMessageLike) => acked.push(msg)),
    deliver: (body: unknown) => onMessage?.({ content: Buffer.from(JSON.stringify(body)) }),
  };

  const conn: AmqpConnectionLike = {
    createChannel: jest.fn().mockResolvedValue(channel),
    on: jest.fn().mockImplementation((event: string, cb: () => void) => {
      if (event === 'close') closeCb = cb;
    }),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return { conn, channel, triggerClose: () => closeCb?.(), acked };
}

describe('RabbitConsumer', () => {
  it('declares the topology and forwards delivered videoIds to the hub', async () => {
    const { conn, channel, triggerClose, acked } = makeFakeConnection();
    const publish = jest.fn();
    const consumer = new RabbitConsumer({
      url: 'amqp://test',
      hub: { publish },
      connect: async () => conn,
      reconnectDelayMs: 0,
    });

    const started = consumer.start();
    await wait(5);

    expect(channel.assertExchange).toHaveBeenCalledWith('video_events', 'topic', { durable: true });
    expect(channel.assertQueue).toHaveBeenCalledWith('', { exclusive: true, autoDelete: true });
    expect(channel.bindQueue).toHaveBeenCalledWith('q-test', 'video_events', '#');

    channel.deliver({ videoId: 'v42' });
    expect(publish).toHaveBeenCalledWith('v42');
    expect(acked).toHaveLength(1);

    await consumer.stop();
    triggerClose();
    await started;
  });

  it('reconnects after a connection failure', async () => {
    const { conn, triggerClose } = makeFakeConnection();
    const connect = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(conn);
    const consumer = new RabbitConsumer({
      url: 'amqp://test',
      hub: { publish: jest.fn() },
      connect,
      reconnectDelayMs: 1,
      logger: { error: jest.fn(), info: jest.fn() },
    });

    const started = consumer.start();
    await wait(20);

    expect(connect).toHaveBeenCalledTimes(2);

    await consumer.stop();
    triggerClose();
    await started;
  });
});
