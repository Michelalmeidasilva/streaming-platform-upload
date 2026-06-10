/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import TranscodeMetrics from '../TranscodeMetrics';

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useI18n: () => ({ t: (k: string) => k, locale: 'en' }),
}));

const sampleRun = {
  id: '1', jobId: 'v1-1', videoId: 'v1', machineLabel: 'c7g.xlarge',
  hostname: 'h', cpuCores: 4, profile: 'p', elapsedSeconds: 42, rtf: 1.5,
  sourceFileSizeBytes: 100, totalOutputSizeBytes: 80, completedAt: '2026-06-09T12:00:00Z',
  renditions: [
    { name: 'h264-720p', codec: 'h264', width: 1280, height: 720, preset: 'veryfast',
      targetBitrateKbps: 3000, outputBitrateKbps: 2950, elapsedSeconds: 20,
      avgCpuPercent: 180, maxCpuPercent: 320, avgMemoryMb: 150, maxMemoryMb: 220 },
  ],
};

describe('TranscodeMetrics', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('renders runs grouped by machine label', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ runs: [sampleRun] }),
    }) as unknown as typeof fetch;

    render(<TranscodeMetrics />);
    await waitFor(() => expect(screen.getByText('c7g.xlarge')).toBeInTheDocument());
    expect(screen.getByText('h264')).toBeInTheDocument();
  });

  it('shows an empty state when there are no runs', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ runs: [] }),
    }) as unknown as typeof fetch;

    render(<TranscodeMetrics />);
    await waitFor(() => expect(screen.getByText('metrics.empty')).toBeInTheDocument());
  });

  it('shows error state when fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    }) as unknown as typeof fetch;

    render(<TranscodeMetrics />);
    await waitFor(() => expect(screen.getByText('metrics.error')).toBeInTheDocument());
  });

  it('renders dash when preset is absent', async () => {
    const runWithoutPreset = {
      ...sampleRun,
      renditions: [{ ...sampleRun.renditions[0], preset: undefined }],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ runs: [runWithoutPreset] }),
    }) as unknown as typeof fetch;

    render(<TranscodeMetrics />);
    await waitFor(() => expect(screen.getByText('c7g.xlarge')).toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
