import { NextRequest } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';
import { getCurrentSession } from '@/lib/auth/session';
import { deriveThumbnailUrl } from '../thumbnail';
import { getVideoEventHub, type VideoUpdatePayload } from '@/lib/realtime/videoEventHub';
import { ensureRealtimeStarted } from '@/lib/realtime/bootstrap';

export const dynamic = 'force-dynamic';

const PING_MS = 15000;

export async function GET(_request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  ensureRealtimeStarted();
  const hub = getVideoEventHub();
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      // One-shot snapshot seeds the client's list; deltas then arrive via the hub.
      try {
        const videos = await uploadService.getAllVideos();
        for (const video of videos) {
          send('video-updated', {
            id: video.id,
            status: video.status,
            processingStatus: video.processingStatus ?? null,
            thumbnailStatus: video.thumbnailStatus ?? null,
            storageConfirmedAt: video.storageConfirmedAt ?? null,
            thumbnailUrl: await deriveThumbnailUrl(video),
          });
        }
      } catch {
        // best-effort snapshot; live events still flow
      }

      /* istanbul ignore next: client disconnected during the snapshot await */
      if (cancelled) {
        return;
      }

      unsubscribe = hub.subscribe((payload: VideoUpdatePayload) => {
        try {
          send('video-updated', payload);
        } catch {
          /* istanbul ignore next */
          if (unsubscribe) unsubscribe();
        }
      });

      /* istanbul ignore next */
      ping = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), PING_MS);
    },
    cancel() {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      if (ping) clearInterval(ping);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
