export type UserRole = 'ADMIN' | 'MEMBER';
export type StorageEncryptionMode = 'AES256';
export type StorageChecksumAlgorithm = 'SHA256';

export interface StorageSecurityPolicy {
  encryptionEnabled: boolean;
  encryptionMode: StorageEncryptionMode;
  checksumAlgorithm: StorageChecksumAlgorithm;
  signedUrlTtlSeconds: number;
}

export interface RecoveryPolicy {
  versioning: 'required';
  backupTarget: 'required';
  replicationTarget: 'required';
  accidentalDeletionRecovery: 'versioning-plus-backup';
  regionalLossRecovery: 'replication-plus-backup';
}

export interface SecurityPosture {
  storage: StorageSecurityPolicy;
  recovery: RecoveryPolicy;
}

export interface Video {
  id: string;
  filename: string;
  originalName: string;
  title: string;
  size: number;
  status: VideoStatus;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  url?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  thumbnailStatus?: 'pending' | 'ready' | 'failed';
  mimeType?: string;
  duration?: number;
  securityPosture?: SecurityPosture;
  processingStatus?: ProcessingStatus;
  storageConfirmedAt?: string;
  source?: VideoSource;
  mediaInfo?: MediaInfo;
  transcode?: TranscodeInfo;
  playback?: PlaybackInfo;
  metrics?: VideoMetrics;
}

export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'error';
export type ProcessingStatus = 'queued' | 'transcoding' | 'packaging' | 'ready' | 'failed';

export type UploadStage =
  | 'uploading'
  | 'uploaded'
  | 'available'
  | 'transcode_pending'
  | 'transcoding'
  | 'transcoded'
  | 'error';

export interface VideoSource {
  bucket?: string;
  key?: string;
  provider?: string;
  size?: number;
  mimeType?: string;
  etag?: string;
  version?: string;
}

export interface MediaInfo {
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  bitrateKbps?: number;
}

export interface Rendition {
  name: string;
  width?: number;
  height?: number;
  resolution?: string;
  codec?: string;
  bitrateKbps?: number;
  manifestPath?: string;
}

export interface TranscodeInfo {
  jobId?: string;
  profile?: string;
  attempt?: number;
  fingerprint?: string;
  startedAt?: string;
  completedAt?: string;
  error?: unknown;
}

export interface PlaybackInfo {
  hlsManifestPath?: string;
  dashManifestPath?: string;
  renditions?: Rendition[];
}

export interface VideoMetrics {
  rtf?: number;
  elapsedSeconds?: number;
  outputSizeMb?: number;
  vmaf?: number;
  ssim?: number;
  psnr?: number;
  metricsPath?: string;
}

export interface UploadSession {
  id: string;
  videoId: string;
  totalChunks: number;
  uploadedChunks: number;
  chunkSize: number;
  totalSize: number;
  startedAt: Date;
  filename: string;
  uploadId: string;
  etags: { PartNumber: number; ETag: string }[];
  securityPosture?: SecurityPosture;
}

export interface UploadChunkRequest {
  sessionId: string;
  chunkIndex: number;
  totalChunks: number;
  chunk: Buffer;
  filename: string;
}

export interface UploadCompleteRequest {
  sessionId: string;
  videoId: string;
}

export interface PersistedUploadState {
  session: UploadSession;
  video: Video;
}

export interface VideoCreateInput {
  filename: string;
  originalName: string;
  size: number;
  mimeType?: string;
}

export interface StorageConfig {
  provider: 's3' | 'minio' | 'memory';
  bucket: string;
  region?: string;
  endpoint?: string;
  /**
   * Browser-reachable base URL for objects (e.g. http://localhost:9000). Used to
   * build public URLs returned to the client, since `endpoint` may point at an
   * internal Docker host (e.g. http://minio:9000) the browser cannot resolve.
   */
  publicEndpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  encryptionEnabled?: boolean;
  encryptionMode?: StorageEncryptionMode;
  checksumAlgorithm?: StorageChecksumAlgorithm;
  signedUrlTtlSeconds?: number;
}

export interface IntegrationConfig {
  name: string;
  type: 'webhook' | 'api' | 'queue' | 'streaming-ingest';
  endpoint?: string;
  apiKey?: string;
  enabled: boolean;
}

export interface IntegrationPayload {
  event: string;
  videoId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface RunRendition {
  name: string;
  codec: string;
  width: number;
  height: number;
  preset?: string;
  targetBitrateKbps: number;
  outputBitrateKbps: number;
  outputFileSizeBytes?: number;
  elapsedSeconds: number;
  avgCpuPercent: number;
  maxCpuPercent: number;
  avgMemoryMb: number;
  maxMemoryMb: number;
}

// Distribution load-test (scalestore) shapes served by /api/distribution-runs.
export interface EngineQoE {
  RunID: number;
  PlayerEngine: 'gpac' | 'shaka';
  Samples: number;
  StartupP50MS: number;
  StartupP95MS: number;
  RebufferRatioAvg: number;
  BitrateAvgKbps: number;
}
export interface DistributionRun {
  id: number;
  tier: string;
  n_viewers: number;
  protocol: string;
  machine: string;
  asset_id: string;
  started_at: string;
  qoe: EngineQoE[];
}
export interface DistributionProjection {
  basis: string;
  n_target: number;
  egress_gb_h: number;
  agg_rps: number;
  connections: number;
  cost_usd_month: number;
  saturation_tier: string;
}

export interface TranscodeRun {
  id: string;
  jobId: string;
  videoId: string;
  machineLabel: string;
  hostname: string;
  cpuCores: number;
  profile: string;
  elapsedSeconds: number;
  rtf: number;
  sourceFileSizeBytes: number;
  totalOutputSizeBytes: number;
  renditions: RunRendition[];
  completedAt: string;
  benchmark?: boolean;
  clip?: string;
  repetition?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceDurationSeconds?: number;
  sourceFps?: number;
  sourceCodec?: string;
  sourceBitrateKbps?: number;
}
