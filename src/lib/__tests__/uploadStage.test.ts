import { deriveUploadStage } from '@/lib/uploadStage';

describe('deriveUploadStage', () => {
  it('returns uploading while status is uploading', () => {
    expect(deriveUploadStage({ status: 'uploading' })).toBe('uploading');
  });

  it('returns uploaded after complete (processing, not yet storage-confirmed)', () => {
    expect(deriveUploadStage({ status: 'processing' })).toBe('uploaded');
  });

  it('returns available once storage confirmed and no processingStatus yet', () => {
    expect(
      deriveUploadStage({ status: 'processing', storageConfirmedAt: '2026-06-04T12:00:00Z' }),
    ).toBe('available');
  });

  it('returns transcode_pending when queued', () => {
    expect(
      deriveUploadStage({ status: 'processing', storageConfirmedAt: '2026-06-04T12:00:00Z', processingStatus: 'queued' }),
    ).toBe('transcode_pending');
  });

  it('returns transcoding for transcoding and packaging', () => {
    expect(deriveUploadStage({ status: 'processing', processingStatus: 'transcoding' })).toBe('transcoding');
    expect(deriveUploadStage({ status: 'processing', processingStatus: 'packaging' })).toBe('transcoding');
  });

  it('returns transcoded when processingStatus is ready', () => {
    expect(deriveUploadStage({ status: 'processing', processingStatus: 'ready' })).toBe('transcoded');
  });

  it('returns transcoded when status is ready', () => {
    expect(deriveUploadStage({ status: 'ready' })).toBe('transcoded');
  });

  it('returns error on failure regardless of other fields', () => {
    expect(deriveUploadStage({ status: 'error' })).toBe('error');
    expect(deriveUploadStage({ status: 'processing', processingStatus: 'failed' })).toBe('error');
  });

  it('prefers the most advanced stage when fields accumulate', () => {
    expect(
      deriveUploadStage({
        status: 'processing',
        storageConfirmedAt: '2026-06-04T12:00:00Z',
        processingStatus: 'transcoding',
      }),
    ).toBe('transcoding');
  });
});
