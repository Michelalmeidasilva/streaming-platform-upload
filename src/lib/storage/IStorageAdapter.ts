export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
}

export interface IStorageAdapter {
  upload(file: Buffer, key: string, contentType: string, checksumSHA256?: string): Promise<string>;
  getUploadPresignedUrl(key: string, contentType: string, expiresIn?: number): Promise<string>;
  initiateMultipartUpload(key: string, contentType: string): Promise<string>;
  uploadPart(chunk: Buffer, key: string, uploadId: string, partNumber: number, checksumSHA256?: string): Promise<string>;
  getUploadPartPresignedUrl(key: string, uploadId: string, partNumber: number, expiresIn?: number): Promise<string>;
  completeMultipartUpload(key: string, uploadId: string, parts: { PartNumber: number; ETag: string }[]): Promise<string>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  /**
   * Returns a browser-reachable URL for an object. Unlike getSignedUrl, this is
   * meant for URLs handed to the client (e.g. thumbnails): for MinIO it uses the
   * public endpoint and is unsigned (the bucket is public-read), so it does not
   * carry an internal Docker host nor an expiring signature.
   */
  getPublicUrl(key: string): Promise<string>;
  exists(key: string): Promise<boolean>;
  listObjects(prefix?: string): Promise<StorageObject[]>;
}

export interface UploadResult {
  url: string;
  key: string;
}
