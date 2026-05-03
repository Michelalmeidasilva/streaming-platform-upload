import { MemoryAdapter, resolveMemoryUploadTarget, resolveMemoryDownloadTarget, storeMemoryUpload, readMemoryObject } from '../MemoryAdapter';

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    globalThis.__memoryStorageState__ = undefined;
    adapter = new MemoryAdapter();
  });

  it('should upload and read objects', async () => {
    const key = 'test.txt';
    const content = Buffer.from('hello world');
    const contentType = 'text/plain';

    const url = await adapter.upload(content, key, contentType);
    expect(url).toContain('download');

    const exists = await adapter.exists(key);
    expect(exists).toBe(true);

    const object = readMemoryObject(key);
    expect(object?.body).toEqual(content);
    expect(object?.contentType).toBe(contentType);
  });

  it('should list objects', async () => {
    await adapter.upload(Buffer.from('1'), 'a/1.txt', 'text/plain');
    await adapter.upload(Buffer.from('2'), 'a/2.txt', 'text/plain');
    await adapter.upload(Buffer.from('3'), 'b/1.txt', 'text/plain');

    const all = await adapter.listObjects();
    expect(all).toHaveLength(3);

    const filtered = await adapter.listObjects('a/');
    expect(filtered).toHaveLength(2);
  });

  it('should delete objects', async () => {
    const key = 'delete-me.txt';
    await adapter.upload(Buffer.from('data'), key, 'text/plain');
    expect(await adapter.exists(key)).toBe(true);

    await adapter.delete(key);
    expect(await adapter.exists(key)).toBe(false);
  });

  it('should handle presigned URLs for upload and download', async () => {
    const key = 'presigned.txt';
    const uploadUrl = await adapter.getUploadPresignedUrl(key, 'text/plain');
    expect(uploadUrl).toContain('upload');

    const token = new URL(uploadUrl, 'http://localhost').searchParams.get('token')!;
    const target = resolveMemoryUploadTarget(token);
    expect(target).toEqual({ type: 'put-object', key });

    const downloadUrl = await adapter.getSignedUrl(key);
    const downloadToken = new URL(downloadUrl, 'http://localhost').searchParams.get('token')!;
    const downloadTarget = resolveMemoryDownloadTarget(downloadToken);
    expect(downloadTarget).toEqual({ type: 'get-object', key });

    // Invalid tokens
    expect(resolveMemoryUploadTarget('invalid')).toBe(null);
    expect(resolveMemoryDownloadTarget('invalid')).toBe(null);
    expect(resolveMemoryUploadTarget(downloadToken)).toBe(null);
    expect(resolveMemoryDownloadTarget(token)).toBe(null);
  });

  it('should handle multipart uploads', async () => {
    const key = 'multipart.bin';
    const uploadId = await adapter.initiateMultipartUpload(key, 'application/octet-stream');
    expect(uploadId).toBeDefined();

    const part1 = Buffer.from('part1');
    const part2 = Buffer.from('part2');

    const etag1 = await adapter.uploadPart(part1, key, uploadId, 1);
    const etag2 = await adapter.uploadPart(part2, key, uploadId, 2);
    expect(etag1).toBeDefined();
    expect(etag2).toBeDefined();

    // Overwrite a part
    await adapter.uploadPart(Buffer.from('newpart1'), key, uploadId, 1);

    const completionUrl = await adapter.completeMultipartUpload(key, uploadId, [
      { PartNumber: 1, ETag: etag1 },
      { PartNumber: 2, ETag: etag2 },
    ]);
    expect(completionUrl).toContain('download');

    const object = readMemoryObject(key);
    expect(object?.body.toString()).toBe('newpart1part2');
  });

  it('should throw on empty multipart upload', async () => {
    const uploadId = 'empty-id';
    await expect(adapter.completeMultipartUpload('key', uploadId, [])).rejects.toThrow('Missing multipart upload parts');
  });

  it('should throw on incomplete multipart upload', async () => {
    const key = 'incomplete.bin';
    const uploadId = await adapter.initiateMultipartUpload(key, 'application/octet-stream');
    await adapter.uploadPart(Buffer.from('part1'), key, uploadId, 1);

    await expect(adapter.completeMultipartUpload(key, uploadId, [
      { PartNumber: 1, ETag: 'e1' },
      { PartNumber: 2, ETag: 'e2' },
    ])).rejects.toThrow('Multipart upload is incomplete');
  });

  it('should handle presigned URLs for multipart parts', async () => {
    const key = 'part.bin';
    const uploadId = 'id123';
    const url = await adapter.getUploadPartPresignedUrl(key, uploadId, 5);
    expect(url).toContain('upload');

    const token = new URL(url, 'http://localhost').searchParams.get('token')!;
    const target = resolveMemoryUploadTarget(token);
    expect(target).toEqual({ type: 'upload-part', key, uploadId, partNumber: 5 });
  });

  it('should store memory upload with default content type', () => {
    const target = { type: 'put-object' as const, key: 'def.txt' };
    storeMemoryUpload(target, Buffer.from('data'));
    const object = readMemoryObject('def.txt');
    expect(object?.contentType).toBe('application/octet-stream');
  });
});
