import {
  canDeleteVideo,
  canDownloadVideo,
  canEditVideo,
  canSearchVideos,
  canUploadVideo,
  canViewVideo,
} from '../permissions';

describe('permission matrix', () => {
  it('allows MEMBER to view, search, and download', () => {
    expect(canViewVideo('MEMBER')).toBe(true);
    expect(canSearchVideos('MEMBER')).toBe(true);
    expect(canDownloadVideo('MEMBER')).toBe(true);
  });

  it('allows ADMIN to do every video action', () => {
    expect(canUploadVideo('ADMIN')).toBe(true);
    expect(canEditVideo('ADMIN')).toBe(true);
    expect(canDeleteVideo('ADMIN')).toBe(true);
  });

  it('blocks non-admin mutation actions', () => {
    expect(canUploadVideo('MEMBER')).toBe(false);
    expect(canEditVideo('MEMBER')).toBe(false);
    expect(canDeleteVideo('MEMBER')).toBe(false);
  });
});
