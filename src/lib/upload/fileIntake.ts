// File-intake helpers for the upload dropzone: which extensions are accepted,
// how raw .yuv geometry is collected, and how sidecar .srt subtitles are paired
// to a video. Kept out of the React component so they can be unit-tested.

export const ACCEPTED_EXTENSIONS = '.mp4,.mov,.m4v,.mkv,.webm,.y4m,.yuv,.m3u8,.srt';
export const RAW_VIDEO_EXTENSIONS = ['.yuv'];

export interface RawVideoInput {
  width: number;
  height: number;
  fps: number;
  pixelFormat?: string;
}

export interface PendingSubtitle {
  file: File;
  language: string;
  label?: string;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function isRawVideoFile(filename: string): boolean {
  return RAW_VIDEO_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

export function isSubtitleFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.srt');
}

export function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

// deriveSubtitleLanguage reads a language from a sidecar name: movie.en.srt → en,
// movie.pt-BR.srt → pt-br. A bare movie.srt has no language and returns ''.
export function deriveSubtitleLanguage(subtitleName: string, videoBaseName: string): string {
  const base = stripExtension(subtitleName);
  if (base.toLowerCase().startsWith(videoBaseName.toLowerCase() + '.')) {
    return base.slice(videoBaseName.length + 1).toLowerCase();
  }
  const parts = base.split('.');
  if (parts.length > 1) return parts[parts.length - 1].toLowerCase();
  return '';
}

// matchSubtitles pairs .srt files to a video by basename (movie.srt /
// movie.en.srt → movie.mp4). When exactly one video is uploaded, any otherwise
// unmatched subtitles are attached to it.
export function matchSubtitles(videoFile: File, subtitleFiles: File[], soleVideo: boolean): PendingSubtitle[] {
  const videoBase = stripExtension(videoFile.name);
  const matched: PendingSubtitle[] = [];
  for (const sub of subtitleFiles) {
    const subBase = stripExtension(sub.name);
    const belongs = subBase.toLowerCase() === videoBase.toLowerCase()
      || subBase.toLowerCase().startsWith(videoBase.toLowerCase() + '.');
    if (belongs || soleVideo) {
      const language = deriveSubtitleLanguage(sub.name, videoBase);
      matched.push({ file: sub, language, label: language ? language.toUpperCase() : undefined });
    }
  }
  return matched;
}

// Headerless raw streams (.yuv) carry no geometry, so it has to be supplied by
// the operator before the upload starts. Returns null when cancelled or invalid.
export function promptRawVideoParams(t: Translate): RawVideoInput | null {
  const dimensions = window.prompt(t('upload.rawVideo.dimensionsPrompt'), '1920x1080');
  if (!dimensions) return null;
  const match = dimensions.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (!match) {
    alert(t('upload.rawVideo.invalidDimensions'));
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);

  const fpsRaw = window.prompt(t('upload.rawVideo.fpsPrompt'), '30');
  if (!fpsRaw) return null;
  const fps = Number(fpsRaw.trim().replace(',', '.'));
  if (!(width > 0) || !(height > 0) || !(fps > 0)) {
    alert(t('upload.rawVideo.invalidMetadata'));
    return null;
  }

  const pixelFormat = (window.prompt(t('upload.rawVideo.pixelFormatPrompt'), 'yuv420p') || 'yuv420p').trim();
  return { width, height, fps, pixelFormat };
}
