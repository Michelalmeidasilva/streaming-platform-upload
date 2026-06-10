import {
  AVAILABLE_CODECS, RENDITION_RESOLUTIONS, DEFAULT_CODECS, DEFAULT_RESOLUTIONS, buildTranscodeSelection,
  DEFAULT_PROTOCOLS, DEFAULT_SEGMENT_SECONDS, RENDITION_DEFAULT_BITRATE,
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

describe('buildTranscodeSelection with format controls', () => {
  it('emits protocols, segmentSeconds and per-resolution bitrate', () => {
    const sel = buildTranscodeSelection(['h264'], ['720p'], {
      protocols: ['hls'],
      segmentSeconds: 4,
      bitrateByResolution: { '720p': 2800 },
    });
    expect(sel).not.toBeNull();
    expect(sel!.protocols).toEqual(['hls']);
    expect(sel!.segmentSeconds).toBe(4);
    expect(sel!.renditions[0]).toMatchObject({ width: 1280, height: 720, codec: 'h264', bitrateKbps: 2800 });
  });

  it('omits bitrateKbps when blank/zero (auto)', () => {
    const sel = buildTranscodeSelection(['h264'], ['720p'], {
      protocols: ['hls', 'dash'],
      segmentSeconds: 6,
      bitrateByResolution: { '720p': undefined },
    });
    expect(sel!.renditions[0]).not.toHaveProperty('bitrateKbps');
  });

  it('returns null when no protocol is selected', () => {
    const sel = buildTranscodeSelection(['h264'], ['720p'], {
      protocols: [],
      segmentSeconds: 6,
    });
    expect(sel).toBeNull();
  });

  it('falls back to a safe preset for an invalid segment value', () => {
    const sel = buildTranscodeSelection(['h264'], ['720p'], {
      protocols: ['hls'],
      segmentSeconds: 5,
    });
    expect(sel!.segmentSeconds).toBe(DEFAULT_SEGMENT_SECONDS);
  });

  it('defaults protocols/segment when opts omitted', () => {
    const sel = buildTranscodeSelection(['h264'], ['720p']);
    expect(sel!.protocols).toEqual(DEFAULT_PROTOCOLS);
    expect(sel!.segmentSeconds).toBe(DEFAULT_SEGMENT_SECONDS);
  });

  it('exposes ladder defaults', () => {
    expect(DEFAULT_PROTOCOLS).toEqual(['hls', 'dash']);
    expect(RENDITION_DEFAULT_BITRATE['1080p']).toBe(5000);
  });
});
