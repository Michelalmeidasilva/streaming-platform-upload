import { POST } from '../route';
import { integrationLayer } from '@/lib/integration';
import { getCurrentSession } from '@/lib/auth/session';
import { canEditVideo } from '@/lib/auth/permissions';
import { NextRequest } from 'next/server';

jest.mock('@/lib/integration', () => ({
  integrationLayer: {
    register: jest.fn(),
    notify: jest.fn(),
    testConnection: jest.fn(),
    getConnectors: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('@/lib/auth/session');
jest.mock('@/lib/auth/permissions');

describe('Integrate API Route', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation();
    (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN', email: 'admin@test.com' } });
    (canEditVideo as unknown as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockRequest = (body: unknown) => {
    return {
      json: jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest;
  };

  describe('authentication', () => {
    it('returns 401 when not authenticated', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue(null);
      const req = mockRequest({ action: 'list' });
      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('returns 403 when authenticated but not admin', async () => {
      (getCurrentSession as jest.Mock).mockResolvedValue({ user: { role: 'MEMBER' } });
      (canEditVideo as unknown as jest.Mock).mockReturnValue(false);
      const req = mockRequest({ action: 'list' });
      const response = await POST(req);
      expect(response.status).toBe(403);
    });
  });

  describe('register action', () => {
    it('registers integration successfully with all config', async () => {
      const config = { name: 'webhook', type: 'webhook', endpoint: 'http://test.com', apiKey: 'key123' };
      const req = mockRequest({ action: 'register', config });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('webhook');
      expect(integrationLayer.register).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'webhook', type: 'webhook', apiKey: 'key123' })
      );
    });

    it('sets enabled to true by default when not specified', async () => {
      const config = { name: 'test', type: 'webhook', endpoint: 'http://test.com' };
      const req = mockRequest({ action: 'register', config });

      await POST(req);

      expect(integrationLayer.register).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );
    });

    it('respects enabled flag when provided', async () => {
      const config = { name: 'test', type: 'webhook', endpoint: 'http://test.com', enabled: false };
      const req = mockRequest({ action: 'register', config });

      await POST(req);

      expect(integrationLayer.register).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it('returns 400 when config is missing', async () => {
      const req = mockRequest({ action: 'register' });
      const response = await POST(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Configuration required');
    });

    it('returns 400 when config is null', async () => {
      const req = mockRequest({ action: 'register', config: null });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });
  });

  describe('notify action', () => {
    it('notifies with event, videoId, and data', async () => {
      const req = mockRequest({ action: 'notify', event: 'upload.completed', videoId: 'vid123', data: { duration: 120 } });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(integrationLayer.notify).toHaveBeenCalledWith('upload.completed', 'vid123', { duration: 120 });
    });

    it('uses empty object for data when not provided', async () => {
      const req = mockRequest({ action: 'notify', event: 'upload.started', videoId: 'vid456' });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(integrationLayer.notify).toHaveBeenCalledWith('upload.started', 'vid456', {});
    });

    it('returns 400 when event is missing', async () => {
      const req = mockRequest({ action: 'notify', videoId: 'vid123' });
      const response = await POST(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Event and videoId required');
    });

    it('returns 400 when videoId is missing', async () => {
      const req = mockRequest({ action: 'notify', event: 'upload.completed' });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when both event and videoId are missing', async () => {
      const req = mockRequest({ action: 'notify' });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });
  });

  describe('test action', () => {
    it('tests connection successfully when connected', async () => {
      (integrationLayer.testConnection as jest.Mock).mockResolvedValue(true);
      const req = mockRequest({ action: 'test', config: { name: 'webhook' } });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Connection successful');
      expect(integrationLayer.testConnection).toHaveBeenCalledWith('webhook');
    });

    it('returns failure message when connection fails', async () => {
      (integrationLayer.testConnection as jest.Mock).mockResolvedValue(false);
      const req = mockRequest({ action: 'test', config: { name: 'webhook' } });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.message).toContain('Connection failed');
    });

    it('returns 400 when config is missing', async () => {
      const req = mockRequest({ action: 'test' });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when config.name is missing', async () => {
      const req = mockRequest({ action: 'test', config: {} });
      const response = await POST(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Integration name required');
    });
  });

  describe('list action', () => {
    it('lists all connectors', async () => {
      const connectors = ['webhook', 'api', 'queue'];
      (integrationLayer.getConnectors as jest.Mock).mockReturnValue(connectors);
      const req = mockRequest({ action: 'list' });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connectors).toEqual(connectors);
    });

    it('returns empty array when no connectors', async () => {
      (integrationLayer.getConnectors as jest.Mock).mockReturnValue([]);
      const req = mockRequest({ action: 'list' });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connectors).toEqual([]);
    });
  });

  describe('remove action', () => {
    it('removes integration by name', async () => {
      const req = mockRequest({ action: 'remove', config: { name: 'webhook' } });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('webhook');
      expect(integrationLayer.remove).toHaveBeenCalledWith('webhook');
    });

    it('returns 400 when config is missing', async () => {
      const req = mockRequest({ action: 'remove' });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when config.name is missing', async () => {
      const req = mockRequest({ action: 'remove', config: {} });
      const response = await POST(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Integration name required');
    });
  });

  describe('error handling', () => {
    it('returns 400 for invalid action', async () => {
      const req = mockRequest({ action: 'invalid' });
      const response = await POST(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid action');
    });

    it('returns 400 for unknown action', async () => {
      const req = mockRequest({ action: 'unknown-action' });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 500 on integration layer error', async () => {
      const req = mockRequest({ action: 'list' });
      (integrationLayer.getConnectors as jest.Mock).mockImplementation(() => {
        throw new Error('Integration failure');
      });
      const response = await POST(req);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Integration failed');
    });

    it('handles JSON parsing errors', async () => {
      const req = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as NextRequest;
      const response = await POST(req);
      expect(response.status).toBe(500);
    });

    it('logs errors to console', async () => {
      const req = mockRequest({ action: 'list' });
      const error = new Error('Test error');
      (integrationLayer.getConnectors as jest.Mock).mockImplementation(() => {
        throw error;
      });
      await POST(req);
      expect(console.error).toHaveBeenCalledWith('Integration error:', error);
    });
  });
});
