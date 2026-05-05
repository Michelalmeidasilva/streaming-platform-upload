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
}

export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'error';

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
  type: 'webhook' | 'api' | 'queue' | 'event-gateway';
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
