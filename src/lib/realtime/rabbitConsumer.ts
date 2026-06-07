import * as amqp from 'amqplib';

export interface AmqpMessageLike {
  content: Buffer;
}

export interface AmqpChannelLike {
  assertExchange(exchange: string, type: string, opts: { durable: boolean }): Promise<unknown>;
  assertQueue(
    queue: string,
    opts: { exclusive: boolean; autoDelete: boolean },
  ): Promise<{ queue: string }>;
  bindQueue(queue: string, exchange: string, pattern: string): Promise<unknown>;
  consume(
    queue: string,
    onMessage: (msg: AmqpMessageLike | null) => void,
    opts?: { noAck: boolean },
  ): Promise<unknown>;
  ack(msg: AmqpMessageLike): void;
}

export interface AmqpConnectionLike {
  createChannel(): Promise<AmqpChannelLike>;
  on(event: 'close' | 'error', cb: (err?: unknown) => void): void;
  close(): Promise<void>;
}

export type AmqpConnector = (url: string) => Promise<AmqpConnectionLike>;

export interface RabbitConsumerOptions {
  url: string;
  hub: { publish(videoId: string): void };
  connect?: AmqpConnector;
  exchange?: string;
  bindingKey?: string;
  reconnectDelayMs?: number;
  logger?: { error: (...args: unknown[]) => void; info: (...args: unknown[]) => void };
}

export function extractVideoId(body: Buffer): string | null {
  try {
    const data = JSON.parse(body.toString('utf-8')) as Record<string, unknown>;
    const nested = (data.video as { id?: unknown } | undefined)?.id;
    const candidate = data.videoId ?? data.video_id ?? nested ?? data.id;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
  } catch {
    return null;
  }
}

const defaultConnect: AmqpConnector = (url) =>
  amqp.connect(url) as unknown as Promise<AmqpConnectionLike>;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class RabbitConsumer {
  private readonly url: string;
  private readonly hub: { publish(videoId: string): void };
  private readonly connect: AmqpConnector;
  private readonly exchange: string;
  private readonly bindingKey: string;
  private readonly reconnectDelayMs: number;
  private readonly logger: { error: (...a: unknown[]) => void; info: (...a: unknown[]) => void };
  private conn?: AmqpConnectionLike;
  private stopped = false;

  constructor(options: RabbitConsumerOptions) {
    this.url = options.url;
    this.hub = options.hub;
    this.connect = options.connect ?? defaultConnect;
    this.exchange = options.exchange ?? 'video_events';
    this.bindingKey = options.bindingKey ?? '#';
    this.reconnectDelayMs = options.reconnectDelayMs ?? 3000;
    this.logger = options.logger ?? console;
  }

  async start(): Promise<void> {
    this.stopped = false;
    while (!this.stopped) {
      try {
        await this.runOnce();
      } catch (err) {
        this.logger.error('[realtime] consumer error', err);
      }
      if (this.stopped) {
        break;
      }
      await delay(this.reconnectDelayMs);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    const conn = this.conn;
    this.conn = undefined;
    if (conn) {
      await conn.close();
    }
  }

  private async runOnce(): Promise<void> {
    const conn = await this.connect(this.url);
    this.conn = conn;
    const channel = await conn.createChannel();
    await channel.assertExchange(this.exchange, 'topic', { durable: true });
    const { queue } = await channel.assertQueue('', { exclusive: true, autoDelete: true });
    await channel.bindQueue(queue, this.exchange, this.bindingKey);
    await channel.consume(
      queue,
      (msg) => {
        if (!msg) {
          return;
        }
        const videoId = extractVideoId(msg.content);
        if (videoId) {
          this.hub.publish(videoId);
        }
        channel.ack(msg);
      },
      { noAck: false },
    );
    this.logger.info(`[realtime] consuming ${this.exchange} via ${queue}`);
    await new Promise<void>((resolve) => {
      conn.on('close', () => resolve());
      conn.on('error', () => resolve());
    });
    this.conn = undefined;
  }
}
