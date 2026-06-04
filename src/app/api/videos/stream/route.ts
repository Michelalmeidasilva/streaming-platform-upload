import { NextRequest } from 'next/server';
import { uploadService } from '@/lib/api/uploadService';
import { getCurrentSession } from '@/lib/auth/session';
import { deriveThumbnailUrl } from '../thumbnail';
import { diffVideos, type StreamSnapshotItem } from './diff';

export const dynamic = 'force-dynamic';

const POLL_MS = 3000;
const PING_MS = 15000;

export async function GET(_request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const encoder = new TextEncoder();
  let prev = new Map<string, StreamSnapshotItem>();
  let poll: ReturnType<typeof setInterval> | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const tick = async () => {
        try {
          const videos = await uploadService.getAllVideos();
          const items: StreamSnapshotItem[] = videos.map((v) => ({
            id: v.id, status: v.status,
            processingStatus: v.processingStatus, thumbnailStatus: v.thumbnailStatus,
            storageConfirmedAt: v.storageConfirmedAt,
          }));
          const { changed, snapshot } = diffVideos(prev, items);
          prev = snapshot;
          for (const item of changed) {
            const video = videos.find((v) => v.id === item.id)!;
            const payload = {
              id: video.id, status: video.status,
              processingStatus: video.processingStatus ?? null,
              thumbnailStatus: video.thumbnailStatus ?? null,
              storageConfirmedAt: video.storageConfirmedAt ?? null,
              thumbnailUrl: await deriveThumbnailUrl(video),
            };
            controller.enqueue(encoder.encode(`event: video-updated\ndata: ${JSON.stringify(payload)}\n\n`));
          }
        } catch {
          // best-effort; keep the connection and retry next tick
        }
      };
      void tick();
      /* istanbul ignore next */
      poll = setInterval(() => void tick(), POLL_MS);
      /* istanbul ignore next */
      ping = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), PING_MS);
    },
    /* istanbul ignore next */
    cancel() {
      if (poll) clearInterval(poll);
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
