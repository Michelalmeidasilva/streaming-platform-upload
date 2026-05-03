import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  ListPartsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageAdapter, StorageObject } from './IStorageAdapter';
import { StorageConfig, StorageSecurityPolicy } from '@/types';
import { resolveStoragePolicy } from '@/lib/security/storage-policy';

function getEncryptionOptions(policy: StorageSecurityPolicy) {
  return policy.encryptionEnabled
    ? { ServerSideEncryption: policy.encryptionMode }
    : {};
}

function normalizeCompletedParts(parts: { PartNumber: number; ETag: string }[]) {
  return [...parts]
    .sort((a, b) => a.PartNumber - b.PartNumber)
    .map(part => ({
      PartNumber: part.PartNumber,
      ETag: part.ETag.startsWith('"') ? part.ETag : `"${part.ETag}"`,
    }));
}

/**
 * S3Adapter — AWS S3 storage implementation for the IStorageAdapter interface.
 * Handles single and multipart uploads with automatic encryption and integrity checking.
 * Supports presigned URLs for direct browser uploads (bypass server).
 * Respects StorageSecurityPolicy for encryption, checksums, and TTLs.
 */
export class S3Adapter implements IStorageAdapter {
  private client: S3Client;
  private bucket: string;
  private policy: StorageSecurityPolicy;

  constructor(config: StorageConfig) {
    this.policy = resolveStoragePolicy(config);
    this.client = new S3Client({
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle || false,
      region: config.region || 'us-east-1',
      credentials: config.accessKeyId && config.secretAccessKey
        ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
        : undefined,
      // AWS SDK v3 >= 3.500 enables flexible checksums by default, which injects
      // x-amz-checksum-crc32 into presigned URLs. The browser cannot compute or
      // supply this header during direct PUT uploads, causing S3 to reject with 400.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    this.bucket = config.bucket;
  }

  private async listUploadedParts(key: string, uploadId: string) {
    const parts: { PartNumber: number; ETag: string }[] = [];
    let partNumberMarker: number | undefined;

    do {
      const response = await this.client.send(new ListPartsCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: partNumberMarker?.toString(),
      }));

      for (const part of response.Parts || []) {
        if (part.PartNumber && part.ETag) {
          parts.push({ PartNumber: part.PartNumber, ETag: part.ETag });
        }
      }

      partNumberMarker = response.IsTruncated && response.NextPartNumberMarker
        ? Number(response.NextPartNumberMarker)
        : undefined;
    } while (partNumberMarker);

    return normalizeCompletedParts(parts);
  }

  async upload(file: Buffer, key: string, contentType: string, checksumSHA256?: string): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
      ...getEncryptionOptions(this.policy),
      ChecksumAlgorithm: this.policy.checksumAlgorithm,
      ...(checksumSHA256 ? { ChecksumSHA256: checksumSHA256 } : {}),
    }));
    return this.getSignedUrl(key);
  }

  async getUploadPresignedUrl(key: string, contentType: string, expiresIn?: number): Promise<string> {
    const ttl = expiresIn ?? this.policy.signedUrlTtlSeconds;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: ttl });
  }

  async initiateMultipartUpload(key: string, contentType: string): Promise<string> {
    const response = await this.client.send(new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ...getEncryptionOptions(this.policy),
    }));
    return response.UploadId || '';
  }

  async uploadPart(
    chunk: Buffer,
    key: string,
    uploadId: string,
    partNumber: number,
    checksumSHA256?: string,
  ): Promise<string> {
    const response = await this.client.send(new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: chunk,
      ...(checksumSHA256 ? { ChecksumSHA256: checksumSHA256 } : { ChecksumAlgorithm: this.policy.checksumAlgorithm }),
    }));
    return (response.ETag || '').replace(/"/g, '');
  }

  async getUploadPartPresignedUrl(key: string, uploadId: string, partNumber: number, expiresIn?: number): Promise<string> {
    const ttl = expiresIn ?? this.policy.signedUrlTtlSeconds;
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(this.client, command, { expiresIn: ttl });
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[],
  ): Promise<string> {
    const completedParts = await this.listUploadedParts(key, uploadId);
    const fallbackParts = normalizeCompletedParts(parts);
    const multipartParts = completedParts.length > 0 ? completedParts : fallbackParts;

    await this.client.send(new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: multipartParts,
      },
    }));
    return this.getSignedUrl(key);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
    const ttl = expiresIn ?? this.policy.signedUrlTtlSeconds;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttl },
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async listObjects(prefix?: string): Promise<StorageObject[]> {
    const response = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix || '',
    }));
    return (response.Contents || [])
      .filter(item => item.Key && !item.Key.includes('.chunk.'))
      .map(item => ({
        key: item.Key!,
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
      }));
  }
}
