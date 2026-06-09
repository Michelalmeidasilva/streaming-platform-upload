import {
  AVAILABLE_CODECS, RENDITION_RESOLUTIONS, DEFAULT_CODECS, DEFAULT_RESOLUTIONS, buildTranscodeSelection,
} from '../transcodeOptions';

describe('transcodeOptions', () => {
  it('exposes 3 codecs and 4 resolutions', () => {
    expect(AVAILABLE_CODECS.map((c) => c.id)).toEqual(['h264', 'h265', 'av1']);
    expect(RENDITION_RESOLUTIONS.map((r) => r.label)).toEqual(['360p', '480p', '720p', '1080p']);
  });
  it('builds the codec×resolution product', () => {
    const sel = buildTranscodeSelection(['h264', 'av1'], ['720p', '1080p']);
    expect(sel!.codecs).toEqual(['h264', 'av1']);
    expect(sel!.renditions).toHaveLength(4);
    expect(sel!.renditions).toContainEqual({ width: 1280, height: 720, codec: 'h264' });
    expect(sel!.renditions).toContainEqual({ width: 1920, height: 1080, codec: 'av1' });
  });
  it('returns null when no codec or no resolution is selected', () => {
    expect(buildTranscodeSelection([], ['720p'])).toBeNull();
    expect(buildTranscodeSelection(['h264'], [])).toBeNull();
  });
  it('ignores unknown resolution labels', () => {
    const sel = buildTranscodeSelection(['h264'], ['720p', 'bogus']);
    expect(sel!.renditions).toEqual([{ width: 1280, height: 720, codec: 'h264' }]);
  });
  it('has sane defaults (h264 + 720p/1080p)', () => {
    expect(DEFAULT_CODECS).toEqual(['h264']);
    expect(DEFAULT_RESOLUTIONS).toEqual(['720p', '1080p']);
  });
});
