import type { UploadStage } from '@/types';

export interface UploadStageInput {
  status?: string;
  processingStatus?: string | null;
  storageConfirmedAt?: string | null;
}

/**
 * Maps the persisted upload signals to one of 6 user-facing stages.
 * Fields accumulate over time, so checks run from most-advanced to least.
 */
export function deriveUploadStage(video: UploadStageInput): UploadStage {
  const { status, processingStatus, storageConfirmedAt } = video;

  if (status === 'error' || processingStatus === 'failed') return 'error';
  if (processingStatus === 'ready' || status === 'ready') return 'transcoded';
  if (processingStatus === 'transcoding' || processingStatus === 'packaging') return 'transcoding';
  if (processingStatus === 'queued') return 'transcode_pending';
  if (storageConfirmedAt) return 'available';
  if (status === 'processing') return 'uploaded';
  return 'uploading';
}
