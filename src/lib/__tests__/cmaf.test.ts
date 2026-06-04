import { validateCMAFFile } from '../cmaf';

describe('validateCMAFFile', () => {
  const createMockFile = (name: string, size: number): File => {
    // Create a file with a blob of specified size without creating huge strings
    const blob = new Blob([new Uint8Array(Math.min(size, 1024))], { type: 'video/mp4' });
    return new File([blob], name, { type: 'video/mp4' });
  };

  const createLargeFile = (name: string, size: number): File => {
    // Override the size property for large files in tests
    const file = new File([], name, { type: 'video/mp4' });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  describe('supported formats', () => {
    it('accepts .mp4 files', () => {
      const file = createMockFile('video.mp4', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
      expect(result.errorKey).toBeUndefined();
    });

    it('accepts .mov files', () => {
      const file = createMockFile('video.mov', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it('accepts .m4v files', () => {
      const file = createMockFile('video.m4v', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it('accepts .webm files', () => {
      const file = createMockFile('video.webm', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it('accepts .m3u8 files', () => {
      const file = createMockFile('playlist.m3u8', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it('handles uppercase extensions', () => {
      const file = createMockFile('VIDEO.MP4', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it('handles mixed case extensions', () => {
      const file = createMockFile('Video.MoV', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it.each(['video.mkv', 'clip.y4m', 'raw.yuv'])('accepts %s', (name) => {
      const result = validateCMAFFile(createMockFile(name, 100));
      expect(result.valid).toBe(true);
    });
  });

  describe('unsupported formats', () => {
    it('rejects .avi files', () => {
      const file = createMockFile('video.avi', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(false);
      expect(result.errorKey).toBe('unsupportedFormat');
    });

    it('rejects .flv files', () => {
      const file = createMockFile('video.flv', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(false);
      expect(result.errorKey).toBe('unsupportedFormat');
    });

    it('rejects files without extension', () => {
      const file = createMockFile('videofile', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(false);
      expect(result.errorKey).toBe('unsupportedFormat');
    });

    it('rejects files with wrong extension', () => {
      const file = createMockFile('video.txt', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(false);
      expect(result.errorKey).toBe('unsupportedFormat');
    });

    it('rejects image files', () => {
      const file = createMockFile('image.jpg', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(false);
      expect(result.errorKey).toBe('unsupportedFormat');
    });
  });

  describe('file size validation', () => {
    it('accepts files under 5GB limit', () => {
      const size = 4 * 1024 * 1024 * 1024; // 4GB
      const file = createLargeFile('video.mp4', size);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it('accepts files at exactly 5GB limit', () => {
      const size = 5 * 1024 * 1024 * 1024; // 5GB
      const file = createLargeFile('video.mp4', size);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it('rejects files over 5GB limit', () => {
      const size = 5 * 1024 * 1024 * 1024 + 1; // 5GB + 1 byte
      const file = createLargeFile('video.mp4', size);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(false);
      expect(result.errorKey).toBe('fileTooLarge');
    });

    it('rejects 6GB files', () => {
      const size = 6 * 1024 * 1024 * 1024; // 6GB
      const file = createLargeFile('video.mp4', size);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(false);
      expect(result.errorKey).toBe('fileTooLarge');
    });

    it('accepts small files', () => {
      const file = createMockFile('video.mp4', 1024); // 1KB
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it('accepts files around 2GB', () => {
      const size = 2 * 1024 * 1024 * 1024; // 2GB
      const file = createLargeFile('video.mp4', size);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('env-configurable size limit', () => {
    const originalPublic = process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB;

    afterEach(() => {
      process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB = originalPublic;
    });

    it('accepts a 6GB file when the limit is raised to 10GB', () => {
      process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB = '10';
      const file = createLargeFile('video.mp4', 6 * 1024 * 1024 * 1024);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it('rejects a file just over the raised 10GB limit', () => {
      process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB = '10';
      const file = createLargeFile('video.mp4', 10 * 1024 * 1024 * 1024 + 1);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(false);
      expect(result.errorKey).toBe('fileTooLarge');
    });
  });

  describe('edge cases', () => {
    it('handles files with multiple dots in name', () => {
      const file = createMockFile('my.video.file.mp4', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it('handles files with extension in name', () => {
      const file = createMockFile('video.mp4.bak', 100);
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(false);
      expect(result.errorKey).toBe('unsupportedFormat');
    });

    it('handles zero-size files with valid extension', () => {
      const file = new File([], 'video.mp4', { type: 'video/mp4' });
      const result = validateCMAFFile(file);
      expect(result.valid).toBe(true);
    });

    it('prioritizes size error over format error', () => {
      const size = 6 * 1024 * 1024 * 1024;
      const file = createLargeFile('video.mp4', size);
      const result = validateCMAFFile(file);
      expect(result.errorKey).toBe('fileTooLarge');
    });
  });

  describe('return value structure', () => {
    it('returns object with valid property on success', () => {
      const file = createMockFile('video.mp4', 100);
      const result = validateCMAFFile(file);
      expect(result).toHaveProperty('valid');
      expect(typeof result.valid).toBe('boolean');
    });

    it('returns errorKey undefined on success', () => {
      const file = createMockFile('video.mp4', 100);
      const result = validateCMAFFile(file);
      expect(result.errorKey).toBeUndefined();
    });

    it('returns errorKey unsupportedFormat on invalid format', () => {
      const file = createMockFile('video.avi', 100);
      const result = validateCMAFFile(file);
      expect(result.errorKey).toBe('unsupportedFormat');
    });

    it('returns errorKey fileTooLarge on oversized file', () => {
      const size = 10 * 1024 * 1024 * 1024;
      const file = createLargeFile('video.mp4', size);
      const result = validateCMAFFile(file);
      expect(result.errorKey).toBe('fileTooLarge');
    });
  });
});
