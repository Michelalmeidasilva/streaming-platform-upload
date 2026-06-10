export type CodecId = 'h264' | 'h265' | 'av1';
export type ProtocolId = 'hls' | 'dash';
export interface CodecOption { id: CodecId; label: string; warn?: string; }
export interface ProtocolOption { id: ProtocolId; label: string; }
export interface ResolutionOption { label: string; width: number; height: number; }
export interface RenditionSelection { width: number; height: number; codec: CodecId; bitrateKbps?: number; }
export interface TranscodeSelection {
  codecs: CodecId[];
  protocols: ProtocolId[];
  segmentSeconds: number;
  renditions: RenditionSelection[];
}

export const AVAILABLE_CODECS: CodecOption[] = [
  { id: 'h264', label: 'H.264 (AVC)' },
  { id: 'h265', label: 'H.265 (HEVC)' },
  { id: 'av1', label: 'AV1', warn: 'AV1 é o encode mais lento — pode demorar bastante.' },
];
export const AVAILABLE_PROTOCOLS: ProtocolOption[] = [
  { id: 'hls', label: 'HLS' },
  { id: 'dash', label: 'DASH' },
];
export const RENDITION_RESOLUTIONS: ResolutionOption[] = [
  { label: '360p', width: 640, height: 360 },
  { label: '480p', width: 854, height: 480 },
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
];
// SEGMENT_PRESETS are the only segment durations offered. They are multiples of
// the 2s GOP (-g 60 at 30fps) so HLS/DASH segments stay keyframe-aligned.
export const SEGMENT_PRESETS: number[] = [2, 4, 6];
// RENDITION_DEFAULT_BITRATE pre-fills the per-resolution kbps inputs. Blank = auto
// (the transcoder picks from its own ladder).
export const RENDITION_DEFAULT_BITRATE: Record<string, number> = {
  '360p': 800, '480p': 1400, '720p': 2800, '1080p': 5000,
};
export const DEFAULT_CODECS: CodecId[] = ['h264'];
export const DEFAULT_PROTOCOLS: ProtocolId[] = ['hls', 'dash'];
export const DEFAULT_RESOLUTIONS: string[] = ['720p', '1080p'];
export const DEFAULT_SEGMENT_SECONDS = 6;

export interface TranscodeOptions {
  protocols: ProtocolId[];
  segmentSeconds: number;
  bitrateByResolution?: Record<string, number | undefined>;
}

const DEFAULT_OPTIONS: TranscodeOptions = {
  protocols: DEFAULT_PROTOCOLS,
  segmentSeconds: DEFAULT_SEGMENT_SECONDS,
};

// buildTranscodeSelection returns the codec×resolution product carrying the
// chosen protocols, segment duration, and optional per-resolution bitrate; or
// null when the selection is incomplete (no codec, no valid resolution, or no
// protocol) so callers can block the upload.
export function buildTranscodeSelection(
  codecs: CodecId[],
  resolutionLabels: string[],
  opts: TranscodeOptions = DEFAULT_OPTIONS,
): TranscodeSelection | null {
  const resolutions = resolutionLabels
    .map((label) => RENDITION_RESOLUTIONS.find((r) => r.label === label))
    .filter((r): r is ResolutionOption => Boolean(r));
  if (codecs.length === 0 || resolutions.length === 0 || opts.protocols.length === 0) return null;
  const segmentSeconds = SEGMENT_PRESETS.includes(opts.segmentSeconds)
    ? opts.segmentSeconds
    : DEFAULT_SEGMENT_SECONDS;
  const renditions: RenditionSelection[] = [];
  for (const codec of codecs) {
    for (const res of resolutions) {
      const bitrate = opts.bitrateByResolution?.[res.label];
      renditions.push({
        width: res.width,
        height: res.height,
        codec,
        ...(typeof bitrate === 'number' && bitrate > 0 ? { bitrateKbps: bitrate } : {}),
      });
    }
  }
  return { codecs, protocols: opts.protocols, segmentSeconds, renditions };
}
