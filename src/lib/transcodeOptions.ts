export type CodecId = 'h264' | 'h265' | 'av1';
export interface CodecOption { id: CodecId; label: string; warn?: string; }
export interface ResolutionOption { label: string; width: number; height: number; }
export interface RenditionSelection { width: number; height: number; codec: CodecId; }
export interface TranscodeSelection { codecs: CodecId[]; renditions: RenditionSelection[]; }

export const AVAILABLE_CODECS: CodecOption[] = [
  { id: 'h264', label: 'H.264 (AVC)' },
  { id: 'h265', label: 'H.265 (HEVC)' },
  { id: 'av1', label: 'AV1', warn: 'AV1 é o encode mais lento — pode demorar bastante.' },
];
export const RENDITION_RESOLUTIONS: ResolutionOption[] = [
  { label: '360p', width: 640, height: 360 },
  { label: '480p', width: 854, height: 480 },
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
];
export const DEFAULT_CODECS: CodecId[] = ['h264'];
export const DEFAULT_RESOLUTIONS: string[] = ['720p', '1080p'];

// buildTranscodeSelection returns the codec×resolution product, or null when the
// selection is incomplete (no codec or no valid resolution) so callers can block.
export function buildTranscodeSelection(codecs: CodecId[], resolutionLabels: string[]): TranscodeSelection | null {
  const resolutions = resolutionLabels
    .map((label) => RENDITION_RESOLUTIONS.find((r) => r.label === label))
    .filter((r): r is ResolutionOption => Boolean(r));
  if (codecs.length === 0 || resolutions.length === 0) return null;
  const renditions: RenditionSelection[] = [];
  for (const codec of codecs) for (const res of resolutions) renditions.push({ width: res.width, height: res.height, codec });
  return { codecs, renditions };
}
