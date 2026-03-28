export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
}

export interface IStorageAdapter {
  upload(file: Buffer, key: string, contentType: string): Promise<string>;
  uploadChunk(chunk: Buffer, key: string, partNumber: number): Promise<void>;
  completeMultipartUpload(key: string, uploadId: string): Promise<string>;
  initiateMultipartUpload(key: string, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
  listObjects(prefix?: string): Promise<StorageObject[]>;
}

export interface UploadResult {
  url: string;
  key: string;
}
