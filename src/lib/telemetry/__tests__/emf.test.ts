import { withEmf, emitEmf } from '@/lib/telemetry/emf';

describe('emitEmf', () => {
  it('writes a valid EMF record to the sink', () => {
    const lines: string[] = [];
    emitEmf({ route: '/api/upload', method: 'POST', status: 200, latencyMs: 12.5 }, (s) => lines.push(s));
    const rec = JSON.parse(lines[0]);
    expect(rec.RequestCount).toBe(1);
    expect(rec.ErrorCount).toBe(0);
    expect(rec.RequestLatency).toBe(12.5);
    expect(rec.service).toBe('streaming-platform-upload');
    expect(rec.route).toBe('/api/upload');
    expect(rec._aws.CloudWatchMetrics[0].Namespace).toBe('VOD/streaming-platform-upload');
  });

  it('counts server errors', () => {
    const lines: string[] = [];
    emitEmf({ route: '/x', method: 'GET', status: 502, latencyMs: 1 }, (s) => lines.push(s));
    expect(JSON.parse(lines[0]).ErrorCount).toBe(1);
  });
});

describe('withEmf', () => {
  it('wraps a handler and emits one record', async () => {
    const lines: string[] = [];
    const handler = withEmf('/api/videos', async () => new Response('ok', { status: 201 }), (s) => lines.push(s));
    const res = await handler(new Request('http://x/api/videos', { method: 'GET' }));
    expect(res.status).toBe(201);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).route).toBe('/api/videos');
  });
});

describe('default sink', () => {
  it('emitEmf writes to stdout when no sink is provided', () => {
    const written: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
    try {
      emitEmf({ route: '/health', method: 'GET', status: 200, latencyMs: 1 });
      expect(written).toHaveLength(1);
      expect(JSON.parse(written[0].trim()).route).toBe('/health');
    } finally {
      (process.stdout.write as jest.Mock).mockRestore();
      void origWrite;
    }
  });

  it('withEmf writes to stdout when no sink is provided', async () => {
    const written: string[] = [];
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
    try {
      const handler = withEmf('/api/health', async () => new Response('ok', { status: 200 }));
      await handler(new Request('http://x/api/health', { method: 'GET' }));
      expect(written).toHaveLength(1);
      expect(JSON.parse(written[0].trim()).route).toBe('/api/health');
    } finally {
      (process.stdout.write as jest.Mock).mockRestore();
    }
  });
});
