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
        ? {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        }
        : undefined,
    });
    this.bucket = config.bucket;
  }

  async upload(file: Buffer, key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    await this.client.send(command);
    return this.getSignedUrl(key);
  }

  async uploadChunk(chunk: Buffer, key: string, partNumber: number): Promise<void> {
    console.log(`Uploading chunk ${partNumber} for key ${key}`);
  }

  async completeMultipartUpload(key: string, uploadId: string): Promise<string> {
    console.log(`Completing multipart upload for key ${key}`);
    return this.getSignedUrl(key);
  }

  async initiateMultipartUpload(key: string, contentType: string): Promise<string> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const response = await this.client.send(command);
    return response.UploadId || '';
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async listObjects(prefix?: string): Promise<StorageObject[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix || '',
    });

    const response = await this.client.send(command);
    const objects: StorageObject[] = [];

    for (const item of response.Contents || []) {
      if (item.Key && !item.Key.includes('.chunk.')) {
        objects.push({
          key: item.Key,
          size: item.Size || 0,
          lastModified: item.LastModified || new Date(),
        });
      }
    }

    return objects;
  }
}
