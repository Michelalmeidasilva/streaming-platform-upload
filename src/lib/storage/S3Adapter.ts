import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageAdapter, StorageObject } from './IStorageAdapter';
import { StorageConfig } from '@/types';

export class S3Adapter implements IStorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor(config: StorageConfig) {
    this.client = new S3Client({
      region: config.region || 'us-east-1',
      credentials: config.accessKeyId && config.secretAccessKey
        ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
        : undefined,
    });
    this.bucket = config.bucket;
  }

  async upload(file: Buffer, key: string, contentType: string): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
    }));
    return this.getSignedUrl(key);
  }

  async initiateMultipartUpload(key: string, contentType: string): Promise<string> {
    const response = await this.client.send(new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    }));
    return response.UploadId || '';
  }

  async uploadPart(chunk: Buffer, key: string, uploadId: string, partNumber: number): Promise<string> {
    const response = await this.client.send(new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: chunk,
    }));
    return response.ETag || '';
  }

  async getUploadPartPresignedUrl(key: string, uploadId: string, partNumber: number, expiresIn = 3600): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[],
  ): Promise<string> {
    await this.client.send(new CompleteMultipartUploadCommand({
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
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
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
