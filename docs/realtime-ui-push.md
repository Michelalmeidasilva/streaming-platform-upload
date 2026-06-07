# Realtime UI Push via RabbitMQ SSE

Design spec: `docs/design-docs/specs/2026-06-07-realtime-ui-push-rabbitmq-design.md`

## Motivation

The previous `GET /api/videos/stream` implementation opened one `setInterval`
per connected browser tab. Every 3 seconds, each connection independently
fetched the full video list from `streaming-ingest` (Mongo), diffed it against
the last snapshot, and emitted any changed rows. With five open tabs the gateway
received five polling bursts every three seconds; with twenty tabs it received
twenty. The cost grew linearly with the number of open browser connections
(O(open tabs)) regardless of whether any video state had actually changed. Under
light load this was invisible; in CI environments with multiple windows open, or
when an operator leaves several browser tabs running, it produced constant
unnecessary database reads.

## Design

### Component map

```
RabbitMQ (video_events topic exchange)
    │
    └── RabbitConsumer  [src/lib/realtime/RabbitConsumer.ts]
            │   exclusive, auto-delete queue per BFF instance
            │   binding key: #  (all routing keys)
            │   acks after extracting videoId
            │
            └── VideoEventHub  [src/lib/realtime/VideoEventHub.ts]
                    │   in-process pub/sub; debounces per videoId (250ms)
                    │   fetches single video via uploadService.getVideo(id)
                    │   derives thumbnailUrl
                    │
                    └── SSE connections  [src/app/api/videos/stream/route.ts]
                            │   one subscriber per open browser tab
                            └── broadcast: event: video-updated
```

### Event-as-trigger, single-fetch

Rather than fetching the entire video list on each event and diffing, the hub
uses the incoming AMQP message purely as a trigger that carries the `videoId`.
It then fetches only that one video (`getVideo(id)`) and emits a `video-updated`
payload. This reduces Mongo load from O(list × open tabs × 3s) to
O(1 per actual state change × number of BFF instances).

The hub debounces rapid bursts for the same `videoId` with a 250ms window. If
`streaming-transcode` emits several `video_events` messages in quick succession
for the same video (e.g. queued → transcoding transitions), only the trailing
edge is forwarded to SSE subscribers.

### One-shot snapshot on connect

When a browser tab connects, the SSE route:

1. Returns 401 if no valid session.
2. Calls `ensureRealtimeStarted()` (idempotent — starts the AMQP consumer once
   per BFF instance via a `globalThis` guard).
3. Fetches the full current video list via `getAllVideos()` and immediately emits
   one `video-updated` event per video. This snapshot ensures the UI is
   consistent even if the tab opened after some events had already been
   published.
4. Subscribes to the hub for subsequent deltas.
5. Runs a 15-second ping keepalive to prevent proxy timeouts.

### Lazy, idempotent bootstrap

`ensureRealtimeStarted()` is called on the first SSE connection. It uses a
`globalThis.__realtimeStarted` guard so that Next.js hot-reload cycles and
multiple parallel route invocations do not spawn multiple consumers. When
`RABBITMQ_URL` is not set, the function is a no-op and the SSE route continues
to work in snapshot-only mode (useful in environments without RabbitMQ).

### Per-instance exclusive queues

Each BFF instance creates an **exclusive, auto-delete** queue at startup and
binds it to the durable `video_events` topic exchange with routing key `#`. The
queue is exclusive (only this connection can read from it) and auto-deletes when
the AMQP connection closes, leaving no stale queues behind. Because each
instance has its own queue, every BFF instance receives every event — there is
no consumer-group partitioning. This is intentional: all instances must be able
to push to all their connected browser tabs.

The `RabbitConsumer` reconnects automatically on connection loss with a 5-second
back-off.

## The Accepted AMQP-Credential Trade-off

The project architecture guideline states:

> `streaming-ingest` is the single RabbitMQ owner. No other service holds AMQP
> credentials. Storage providers send HTTP webhooks to the gateway; the gateway
> publishes to RabbitMQ.

The BFF now holds `RABBITMQ_URL` and maintains an AMQP consumer connection.
This deviates from the guideline. The deviation was explicitly approved for the
following reasons:

- The BFF is a **consumer-only** subscriber. It never publishes messages, never
  declares the exchange, and never creates durable infrastructure on the broker.
  The exchange (`video_events`, durable topic) is declared and owned by
  `streaming-ingest`.
- The gateway/ingest still **never consumes** — it remains a pure
  publish-only gateway. The "ingest is the sole publisher" invariant is
  preserved.
- The alternative — having `streaming-ingest` push updates to the BFF via HTTP
  or WebSocket — would couple the gateway to the BFF's lifecycle, add a new
  inbound dependency to a service that is designed to be stateless and
  uni-directional, and reintroduce polling or a separate push channel.
- The polling it replaces was already a scaling liability that would require
  architectural surgery to fix without some form of event bus access.

The credential scope is minimal: `guest/guest` on the local broker, or a
dedicated read-only AMQP user in production. The BFF does not need write
permissions beyond binding its own transient queue.

## Caveats

### Ack-on-receive reliability model

The `RabbitConsumer` acks each message immediately after extracting the
`videoId`, before the hub finishes fetching and broadcasting. If the BFF crashes
between the ack and the fetch, the event is lost for that instance. This is
intentional: the snapshot-on-connect mechanism provides eventual convergence.
A client that misses a delta will receive the correct state the next time it
reconnects (new snapshot) or the next time any event for that video arrives
(hub re-fetches the current state). For an admin upload UI this trade-off is
acceptable.

### Binding key `#`

The exclusive queue is bound with routing key `#`, which matches all messages on
the exchange regardless of routing key. This means the BFF receives events for
all stages (`video.upload.started`, `video.upload.completed`, `video.transcode.*`,
etc.). The hub uses the `videoId` extracted from the message to fetch the current
video state and broadcast it — it does not filter by routing key. Adding new
routing keys to the exchange has no impact on the BFF consumer.

### Debounce window

The 250ms per-`videoId` debounce is a best-effort burst coalescer. It does not
guarantee exactly-once delivery to SSE subscribers; in practice, a burst of
events for the same video within 250ms results in one hub fetch and one
broadcast.
