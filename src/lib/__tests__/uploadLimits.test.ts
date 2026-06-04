import { getMaxFileSizeGB, getMaxFileSizeBytes } from '../uploadLimits';

describe('uploadLimits', () => {
  const original = {
    server: process.env.UPLOAD_MAX_FILE_SIZE_GB,
    publicVar: process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB,
  };

  afterEach(() => {
    process.env.UPLOAD_MAX_FILE_SIZE_GB = original.server;
    process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB = original.publicVar;
  });

  it('defaults to 5 GB when no env is set', () => {
    delete process.env.UPLOAD_MAX_FILE_SIZE_GB;
    delete process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB;
    expect(getMaxFileSizeGB()).toBe(5);
    expect(getMaxFileSizeBytes()).toBe(5 * 1024 * 1024 * 1024);
  });

  it('reads the server env UPLOAD_MAX_FILE_SIZE_GB', () => {
    delete process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB;
    process.env.UPLOAD_MAX_FILE_SIZE_GB = '10';
    expect(getMaxFileSizeGB()).toBe(10);
    expect(getMaxFileSizeBytes()).toBe(10 * 1024 * 1024 * 1024);
  });

  it('falls back to the NEXT_PUBLIC env when the server var is absent', () => {
    delete process.env.UPLOAD_MAX_FILE_SIZE_GB;
    process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB = '8';
    expect(getMaxFileSizeGB()).toBe(8);
  });

  it('prefers the server var over the NEXT_PUBLIC var', () => {
    process.env.UPLOAD_MAX_FILE_SIZE_GB = '10';
    process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB = '8';
    expect(getMaxFileSizeGB()).toBe(10);
  });

  it('falls back to default for non-numeric, zero or negative values', () => {
    delete process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB;
    for (const bad of ['abc', '0', '-3', '']) {
      process.env.UPLOAD_MAX_FILE_SIZE_GB = bad;
      expect(getMaxFileSizeGB()).toBe(5);
    }
  });
});
