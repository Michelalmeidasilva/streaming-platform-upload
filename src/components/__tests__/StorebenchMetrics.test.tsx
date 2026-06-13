/** @jest-environment jsdom */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StorebenchMetrics from '@/components/StorebenchMetrics';

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const mockBenchRuns = [{
  id: 2, machine: 'local', go_version: 'go1.22', started_at: '2026-06-13T01:00:00Z', notes: '',
  results: [
    { run_id: 2, suite: 'BenchmarkRead', name: 'BenchmarkRead/redis', ns_per_op: 1234.5, bytes_per_op: 64, allocs_per_op: 2, iters: 100 },
    { run_id: 2, suite: 'BenchmarkRead', name: 'BenchmarkRead/mongo', ns_per_op: 5678, bytes_per_op: null, allocs_per_op: null, iters: 50 },
  ],
}];

const mockHttpRuns = [{
  id: 1, mode: 'vus', vus: 10, rate: 0, maxvus: 0, trials: 3, duration: '15s',
  machine: 'local', started_at: '2026-06-13T00:00:00Z', notes: '',
  results: [{ run_id: 1, n: 1000, config: 'redis', req_s: 900.5, p95_ms: 12, dropped: 0, payload_bytes: 1, sha256: 'x' }],
}];

describe('StorebenchMetrics', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; jest.clearAllMocks(); });

  it('renders the HTTP matrix from the API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ httpRuns: mockHttpRuns, benchRuns: [] }),
    }) as unknown as typeof fetch;

    render(<StorebenchMetrics />);
    await waitFor(() => expect(screen.getByText('redis')).toBeInTheDocument());
    expect(screen.getByText('900.5')).toBeInTheDocument();
  });

  it('shows an empty state when there are no runs', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ httpRuns: [], benchRuns: [] }) }) as unknown as typeof fetch;
    render(<StorebenchMetrics />);
    await waitFor(() => expect(screen.getByText('storageBench.empty')).toBeInTheDocument());
  });

  it('shows an error state when the API fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 }) as unknown as typeof fetch;
    render(<StorebenchMetrics />);
    await waitFor(() => expect(screen.getByText('storageBench.error')).toBeInTheDocument());
  });

  it('switches to micro view and renders bench run cards', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ httpRuns: mockHttpRuns, benchRuns: mockBenchRuns }),
    }) as unknown as typeof fetch;

    render(<StorebenchMetrics />);
    await waitFor(() => expect(screen.getByText('redis')).toBeInTheDocument());

    const microBtn = screen.getByText('storageBench.viewMicro');
    fireEvent.click(microBtn);

    await waitFor(() => expect(screen.getByText('BenchmarkRead')).toBeInTheDocument());
    expect(screen.getByText('BenchmarkRead/redis')).toBeInTheDocument();
    expect(screen.getByText('1235')).toBeInTheDocument(); // ns_per_op.toFixed(0) = 1235
    expect(screen.getByText('64')).toBeInTheDocument();   // bytes_per_op
    expect(screen.getByText('BenchmarkRead/mongo')).toBeInTheDocument();
  });

  it('shows empty state when switching to micro view with no bench runs', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ httpRuns: mockHttpRuns, benchRuns: [] }),
    }) as unknown as typeof fetch;

    render(<StorebenchMetrics />);
    await waitFor(() => expect(screen.getByText('redis')).toBeInTheDocument());

    fireEvent.click(screen.getByText('storageBench.viewMicro'));
    await waitFor(() => expect(screen.getByText('storageBench.empty')).toBeInTheDocument());
  });

  it('switches back to http view from micro', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ httpRuns: mockHttpRuns, benchRuns: mockBenchRuns }),
    }) as unknown as typeof fetch;

    render(<StorebenchMetrics />);
    await waitFor(() => expect(screen.getByText('redis')).toBeInTheDocument());

    fireEvent.click(screen.getByText('storageBench.viewMicro'));
    await waitFor(() => expect(screen.getByText('BenchmarkRead')).toBeInTheDocument());

    fireEvent.click(screen.getByText('storageBench.viewHttp'));
    await waitFor(() => expect(screen.getByText('redis')).toBeInTheDocument());
  });
});
