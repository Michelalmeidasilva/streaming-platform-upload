import { Client } from 'minio';
import { IStorageAdapter, StorageObject } from './IStorageAdapter';
import { StorageConfig } from '@/types';

export class MinIOAdapter implements IStorageAdapter {
  private client: Client;
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

    await this.client.putObject(
      this.bucket,
      key,
      file,
      file.length,
      { 'Content-Type': contentType }
    );

    return this.getSignedUrl(key);
  }

  async uploadChunk(chunk: Buffer, key: string, partNumber: number): Promise<void> {
    await this.ensureBucket();
    const tempKey = `${key}.chunk.${partNumber}`;

    await this.client.putObject(
      this.bucket,
      tempKey,
      chunk,
      chunk.length
    );
  }

  async completeMultipartUpload(key: string, uploadId: string): Promise<string> {
    return this.getSignedUrl(key);
  }

  async initiateMultipartUpload(key: string, contentType: string): Promise<string> {
    await this.ensureBucket();
    return `mock-upload-id-${Date.now()}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const url = await this.client.presignedGetObject(
      this.bucket,
      key,
      expiresIn
    );
    return url;
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
        // Filter out chunk files
        if (obj.name && !obj.name.includes('.chunk.')) {
          objects.push({
            key: obj.name,
            size: obj.size,
            lastModified: obj.lastModified,
          });
        }
      });

      stream.on('end', () => resolve(objects));
      stream.on('error', (err) => reject(err));
    });
  }
}
