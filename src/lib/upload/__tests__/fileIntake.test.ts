/**
 * @jest-environment jsdom
 */
import {
  isRawVideoFile,
  isSubtitleFile,
  stripExtension,
  deriveSubtitleLanguage,
  matchSubtitles,
  promptRawVideoParams,
  ACCEPTED_EXTENSIONS,
} from '../fileIntake';

const file = (name: string) => new File(['x'], name);

describe('fileIntake', () => {
  it('ACCEPTED_EXTENSIONS includes new formats and srt', () => {
    for (const ext of ['.mkv', '.y4m', '.yuv', '.srt']) {
      expect(ACCEPTED_EXTENSIONS).toContain(ext);
    }
  });

  it('isRawVideoFile detects .yuv case-insensitively', () => {
    expect(isRawVideoFile('clip.YUV')).toBe(true);
    expect(isRawVideoFile('clip.mp4')).toBe(false);
  });

  it('isSubtitleFile detects .srt', () => {
    expect(isSubtitleFile('movie.SRT')).toBe(true);
    expect(isSubtitleFile('movie.vtt')).toBe(false);
  });

  it('stripExtension drops the last extension', () => {
    expect(stripExtension('movie.en.srt')).toBe('movie.en');
    expect(stripExtension('noext')).toBe('noext');
  });

  describe('deriveSubtitleLanguage', () => {
    it('reads the language suffix relative to the video base', () => {
      expect(deriveSubtitleLanguage('movie.en.srt', 'movie')).toBe('en');
      expect(deriveSubtitleLanguage('movie.pt-BR.srt', 'movie')).toBe('pt-br');
    });
    it('returns empty for a bare basename match', () => {
      expect(deriveSubtitleLanguage('movie.srt', 'movie')).toBe('');
    });
    it('falls back to the trailing dotted token', () => {
      expect(deriveSubtitleLanguage('other.fr.srt', 'movie')).toBe('fr');
    });
  });

  describe('matchSubtitles', () => {
    it('pairs by basename and derives language', () => {
      const video = file('movie.mp4');
      const subs = [file('movie.srt'), file('movie.en.srt'), file('unrelated.fr.srt')];
      const matched = matchSubtitles(video, subs, false);
      expect(matched.map(m => m.file.name)).toEqual(['movie.srt', 'movie.en.srt']);
      expect(matched[1]).toMatchObject({ language: 'en', label: 'EN' });
      // Bare match has no language and therefore no label.
      expect(matched[0].label).toBeUndefined();
    });

    it('attaches unmatched subtitles when there is a single video', () => {
      const matched = matchSubtitles(file('movie.mp4'), [file('legendas.srt')], true);
      expect(matched).toHaveLength(1);
    });

    it('ignores unmatched subtitles when multiple videos are present', () => {
      const matched = matchSubtitles(file('movie.mp4'), [file('outro.srt')], false);
      expect(matched).toHaveLength(0);
    });
  });

  describe('promptRawVideoParams', () => {
    const t = (k: string) => k;
    afterEach(() => jest.restoreAllMocks());

    it('parses dimensions, fps and pixel format', () => {
      jest.spyOn(window, 'prompt')
        .mockReturnValueOnce('1920x1080')
        .mockReturnValueOnce('30')
        .mockReturnValueOnce('yuv420p');
      expect(promptRawVideoParams(t)).toEqual({ width: 1920, height: 1080, fps: 30, pixelFormat: 'yuv420p' });
    });

    it('defaults the pixel format when blank', () => {
      jest.spyOn(window, 'prompt')
        .mockReturnValueOnce('1280x720')
        .mockReturnValueOnce('24')
        .mockReturnValueOnce('');
      expect(promptRawVideoParams(t)?.pixelFormat).toBe('yuv420p');
    });

    it('returns null when cancelled', () => {
      jest.spyOn(window, 'prompt').mockReturnValueOnce(null);
      expect(promptRawVideoParams(t)).toBeNull();
    });

    it('rejects malformed dimensions', () => {
      jest.spyOn(window, 'prompt').mockReturnValueOnce('not-a-size');
      jest.spyOn(window, 'alert').mockImplementation(() => {});
      expect(promptRawVideoParams(t)).toBeNull();
    });

    it('rejects a non-positive fps', () => {
      jest.spyOn(window, 'prompt')
        .mockReturnValueOnce('1920x1080')
        .mockReturnValueOnce('0');
      jest.spyOn(window, 'alert').mockImplementation(() => {});
      expect(promptRawVideoParams(t)).toBeNull();
    });
  });
});
