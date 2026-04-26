import { Client } from 'minio';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { IStorageAdapter, StorageObject } from './IStorageAdapter';
import { StorageConfig } from '@/types';

export class MinIOAdapter implements IStorageAdapter {
  private client: Client;
  private s3Client: S3Client;
  private bucket: string;

  constructor(config: StorageConfig) {
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

  async upload(file: Buffer, key: string, contentType: string): Promise<string> {
    await this.ensureBucket();
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
    }));
    return this.getSignedUrl(key);
  }

  async initiateMultipartUpload(key: string, contentType: string): Promise<string> {
    await this.ensureBucket();
    const response = await this.s3Client.send(new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    }));
    return response.UploadId || '';
  }

  async uploadPart(chunk: Buffer, key: string, uploadId: string, partNumber: number): Promise<string> {
    const response = await this.s3Client.send(new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: chunk,
    }));
    return response.ETag || '';
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

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiresIn);
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
