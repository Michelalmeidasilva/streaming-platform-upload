import { Client } from 'minio';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageAdapter, StorageObject } from './IStorageAdapter';
import { StorageConfig, StorageSecurityPolicy } from '@/types';
import { resolveStoragePolicy } from '@/lib/security/storage-policy';

export class MinIOAdapter implements IStorageAdapter {
  private client: Client;
  private s3Client: S3Client;
  private bucket: string;
  private policy: StorageSecurityPolicy;

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
      ServerSideEncryption: this.policy.encryptionMode,
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
      ServerSideEncryption: this.policy.encryptionMode,
      ChecksumAlgorithm: this.policy.checksumAlgorithm,
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
    const response = await this.s3Client.send(new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: chunk,
      ...(checksumSHA256 ? { ChecksumSHA256: checksumSHA256 } : { ChecksumAlgorithm: this.policy.checksumAlgorithm }),
    }));
    return response.ETag || '';
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
    await this.s3Client.send(new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts].sort((a, b) => a.PartNumber - b.PartNumber),
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
