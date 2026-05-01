import { NextResponse } from 'next/server';
import { storageAdapter } from '@/lib/api/uploadService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const gatewayUrl = process.env.EVENT_GATEWAY_URL || 'http://localhost:8080/api/v1';
    
    const endpoint = query 
      ? `${gatewayUrl}/videos/search?q=${encodeURIComponent(query)}`
      : `${gatewayUrl}/videos`;

    const response = await fetch(endpoint, {
      cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Event Gateway returned ${response.status}`);
    }

    const { videos: gatewayVideos } = await response.json();

    const videos = await Promise.all(gatewayVideos.map(async (v: any) => {
      const thumbnailKey = `thumbnails/${v.videoId}.jpg`;
      const fallbackKey = `thumbnails/${v.videoId}-fallback.jpg`;
      let thumbnailUrl = null;

      if (await storageAdapter.exists(thumbnailKey)) {
        thumbnailUrl = await storageAdapter.getSignedUrl(thumbnailKey);
      } else if (await storageAdapter.exists(fallbackKey)) {
        thumbnailUrl = await storageAdapter.getSignedUrl(fallbackKey);
      }

      return {
        id: v.videoId,
        originalName: v.filename,
        size: v.size,
        status: 'ready', // Gateway indicates successful recording in storage
        createdAt: v.createdAt,
        url: v.url,
        thumbnailUrl,
      };
    }));

    // Sort newest first
    videos.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Failed to fetch videos from Event Gateway:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos from Event Gateway' },
      { status: 500 }
    );
  }
}
