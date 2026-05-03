/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST } from '../route';
import { uploadService } from '@/lib/api/uploadService';
import { getCurrentSession } from '@/lib/auth/session';
import { canUploadVideo } from '@/lib/auth/permissions';
import { recordSecurityEvent } from '@/lib/security/audit';
import { NextRequest } from 'next/server';

jest.mock('@/lib/api/uploadService');
jest.mock('@/lib/auth/session');
jest.mock('@/lib/auth/permissions', () => ({
  canUploadVideo: jest.fn(),
}));
jest.mock('@/lib/security/audit', () => ({
  recordSecurityEvent: jest.fn(),
}));

describe('Chunk Upload API Route', () => {
  const mockReq = (sessionId: string | null, chunkIndex: string | null, body = new ArrayBuffer(1024)) => ({
    nextUrl: {
      searchParams: {
        get: jest.fn().mockImplementation((key) => (key === 'sessionId' ? sessionId : chunkIndex)),
      },
    },
    arrayBuffer: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation();
    (uploadService.uploadChunk as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('successful upload', () => {
    it('uploads chunk with admin role', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({
        user: { role: 'ADMIN', email: 'admin@test.com' },
      });
      (canUploadVideo as any).mockReturnValue(true);

      const req = mockReq('session-123', '0');
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(uploadService.uploadChunk).toHaveBeenCalledWith('session-123', 0, expect.any(Buffer));
    });

    it('converts chunkIndex string to number', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);

      const req = mockReq('session-123', '5');
      await POST(req);

      expect(uploadService.uploadChunk).toHaveBeenCalledWith('session-123', 5, expect.any(Buffer));
    });

    it('handles large chunk indices', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);

      const req = mockReq('session-123', '999');
      await POST(req);

      expect(uploadService.uploadChunk).toHaveBeenCalledWith('session-123', 999, expect.any(Buffer));
    });

    it('passes buffer from request body', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);

      const testData = new ArrayBuffer(512);
      const req = mockReq('session-123', '0', testData);
      await POST(req);

      expect(uploadService.uploadChunk).toHaveBeenCalledWith('session-123', 0, expect.any(Buffer));
    });
  });

  describe('authorization failures', () => {
    it('returns 401 when session is null', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue(null);

      const req = mockReq('session-123', '0');
      const response = await POST(req);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
      expect(recordSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'access_denied',
          reason: 'missing_session',
          status: 401,
        })
      );
    });

    it('returns 401 when session is undefined', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue(undefined);

      const req = mockReq('session-123', '0');
      const response = await POST(req);

      expect(response.status).toBe(401);
    });

    it('returns 403 when user cannot upload', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({
        user: { role: 'MEMBER', email: 'user@test.com' },
      });
      (canUploadVideo as any).mockReturnValue(false);

      const req = mockReq('session-123', '0');
      const response = await POST(req);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
      expect(recordSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'access_denied',
          reason: 'insufficient_role',
          status: 403,
          role: 'MEMBER',
        })
      );
    });
  });

  describe('parameter validation', () => {
    it('returns 400 when sessionId is missing', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);

      const req = mockReq(null, '0');
      const response = await POST(req);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('sessionId and chunkIndex are required');
    });

    it('returns 400 when chunkIndex is missing', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);

      const req = mockReq('session-123', null);
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('returns 400 when chunkIndex is not a number', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);

      const req = mockReq('session-123', 'abc');
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('returns 400 when chunkIndex is negative', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);

      const req = mockReq('session-123', '-1');
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('returns 400 when both sessionId and chunkIndex are missing', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);

      const req = mockReq(null, null);
      const response = await POST(req);

      expect(response.status).toBe(400);
    });
  });

  describe('error handling', () => {
    it('handles invalid session error', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);
      (uploadService.uploadChunk as jest.Mock).mockRejectedValue(new Error('Invalid session'));

      const req = mockReq('bad-session', '0');
      const response = await POST(req);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid session');
    });

    it('handles generic upload error with 500 status', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);
      (uploadService.uploadChunk as jest.Mock).mockRejectedValue(new Error('Upload failed'));

      const req = mockReq('session-123', '0');
      const response = await POST(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Upload failed');
    });

    it('logs errors to console', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);
      const error = new Error('Test error');
      (uploadService.uploadChunk as jest.Mock).mockRejectedValue(error);

      const req = mockReq('session-123', '0');
      await POST(req);

      expect(console.error).toHaveBeenCalledWith('Chunk upload error:', error);
    });

    it('handles non-Error objects thrown', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } });
      (canUploadVideo as any).mockReturnValue(true);
      (uploadService.uploadChunk as jest.Mock).mockRejectedValue('String error');

      const req = mockReq('session-123', '0');
      const response = await POST(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('String error');
    });
  });

  describe('security recording', () => {
    it('records security event for missing session', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue(null);

      const req = mockReq('session-123', '0');
      await POST(req);

      expect(recordSecurityEvent).toHaveBeenCalledWith({
        type: 'access_denied',
        route: '/api/upload/chunk',
        method: 'POST',
        reason: 'missing_session',
        status: 401,
        email: null,
        role: null,
      });
    });

    it('records security event for insufficient role', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({
        user: { role: 'MEMBER', email: 'user@test.com' },
      });
      (canUploadVideo as any).mockReturnValue(false);

      const req = mockReq('session-123', '0');
      await POST(req);

      expect(recordSecurityEvent).toHaveBeenCalledWith({
        type: 'access_denied',
        route: '/api/upload/chunk',
        method: 'POST',
        reason: 'insufficient_role',
        status: 403,
        email: 'user@test.com',
        role: 'MEMBER',
      });
    });
  });
});
