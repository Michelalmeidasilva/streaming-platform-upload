import { randomUUID } from 'crypto';
import { Client, CopyDestinationOptions, CopySourceOptions } from 'minio';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  PutObjectCommand,
  ListPartsCommand,
  AbortMultipartUploadCommand,
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

export class MinIOAdapter implements IStorageAdapter {
  private client: Client;
  private s3Client: S3Client;
  private bucket: string;
  private policy: StorageSecurityPolicy;
  private publicEndpoint: string;
  private multipartComposeState = new Map<string, { key: string; partKeys: Map<number, string> }>();

  constructor(config: StorageConfig) {
    this.policy = resolveStoragePolicy(config);
    const cleanEndpoint = (config.endpoint?.replace('http://', '').replace('https://', '') || 'localhost').split(':')[0];
    this.client = new Client({
      endPoint: cleanEndpoint,
      port: config.endpoint ? this.extractPort(config.endpoint) : 9000,
      useSSL: config.endpoint?.startsWith('https') || false,
      accessKey: config.accessKeyId || 'minioadmin',
      secretKey: config.secretAccessKey || 'minioadmin',
    });
    this.s3Client = new S3Client({
      endpoint: config.endpoint || 'http://localhost:9000',
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId || 'minioadmin',
        secretAccessKey: config.secretAccessKey || 'minioadmin',
      },
    });
    this.bucket = config.bucket;
    // Browser-facing base. Defaults to the internal endpoint for backwards
    // compatibility, but in Docker it should be the host-published URL
    // (MINIO_PUBLIC_ENDPOINT=http://localhost:9000) so the browser can load it.
    this.publicEndpoint = (config.publicEndpoint || config.endpoint || 'http://localhost:9000').replace(/\/+$/, '');
  }

  private async listUploadedParts(key: string, uploadId: string) {
    const parts: { PartNumber: number; ETag: string }[] = [];
    let partNumberMarker: number | undefined;

    do {
      const response = await this.s3Client.send(new ListPartsCommand({
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

  private extractPort(endpoint: string): number {
    const match = endpoint.match(/:(\d+)/);
    return match ? parseInt(match[1], 10) : 9000;
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async upload(file: Buffer, key: string, contentType: string, checksumSHA256?: string): Promise<string> {
    await this.ensureBucket();
    await this.s3Client.send(new PutObjectCommand({
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
    await this.ensureBucket();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: ttl });
  }

  async initiateMultipartUpload(key: string, contentType: string): Promise<string> {
    await this.ensureBucket();
    const response = await this.s3Client.send(new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ...getEncryptionOptions(this.policy),
    }));
    const uploadId = response.UploadId || randomUUID();
    this.multipartComposeState.set(uploadId, { key, partKeys: new Map() });
    return uploadId;
  }

  async uploadPart(
    chunk: Buffer,
    key: string,
    uploadId: string,
    partNumber: number,
    _checksumSHA256?: string,
  ): Promise<string> {
    const composeSession = this.multipartComposeState.get(uploadId);
    if (composeSession) {
      await this.ensureBucket();
      const partKey = `${key}.__part__.${uploadId}.${partNumber}`;
      await this.client.putObject(this.bucket, partKey, chunk, chunk.byteLength, {
        'Content-Type': 'application/octet-stream',
      });
      composeSession.partKeys.set(partNumber, partKey);
      return randomUUID().replace(/-/g, '');
    }

    const response = await this.s3Client.send(new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: chunk,
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
    return getSignedUrl(this.s3Client, command, { expiresIn: ttl });
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[],
  ): Promise<string> {
    const composeSession = this.multipartComposeState.get(uploadId);
    if (composeSession && composeSession.partKeys.size > 0) {
      const orderedPartKeys = Array.from(composeSession.partKeys.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, partKey]) => partKey);

      await this.client.composeObject(
        new CopyDestinationOptions({
          Bucket: this.bucket,
          Object: key,
        }),
        orderedPartKeys.map(partKey => new CopySourceOptions({
          Bucket: this.bucket,
          Object: partKey,
        })),
      );

      await Promise.all(orderedPartKeys.map(partKey => this.client.removeObject(this.bucket, partKey)));
      this.multipartComposeState.delete(uploadId);
      await this.s3Client.send(new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: composeSession.key,
        UploadId: uploadId,
      })).catch(() => undefined);
      return this.getSignedUrl(key);
    }

    const completedParts = await this.listUploadedParts(key, uploadId);
    const fallbackParts = normalizeCompletedParts(parts);
    const multipartParts = completedParts.length > 0 ? completedParts : fallbackParts;

    await this.s3Client.send(new CompleteMultipartUploadCommand({
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
    await this.client.removeObject(this.bucket, key);
  }

  async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
    const ttl = expiresIn ?? this.policy.signedUrlTtlSeconds;
    return this.client.presignedGetObject(this.bucket, key, ttl);
  }

  async getPublicUrl(key: string): Promise<string> {
    // Path-style, unsigned URL against the public endpoint. Relies on the bucket
    // being public-read (same model as streaming-distribution's CDN_BASE).
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `${this.publicEndpoint}/${this.bucket}/${encodedKey}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async listObjects(prefix?: string): Promise<StorageObject[]> {
    await this.ensureBucket();
    return new Promise((resolve, reject) => {
      const objects: StorageObject[] = [];
      const stream = this.client.listObjectsV2(this.bucket, prefix || '', true);
      stream.on('data', (obj) => {
        if (obj.name && !obj.name.includes('.chunk.')) {
          objects.push({ key: obj.name, size: obj.size, lastModified: obj.lastModified });
        }
      });
      stream.on('end', () => resolve(objects));
      stream.on('error', reject);
    });
  }
}
