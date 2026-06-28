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

  it('switches to benchmark view and requests benchmark runs', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [{
        ...sampleRun, benchmark: true, clip: 'a.mp4',
        renditions: [{ ...sampleRun.renditions[0], codec: 'av1', height: 1080 }],
      }] }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TranscodeMetrics />);
    await waitFor(() => expect(screen.getByText('metrics.empty')).toBeInTheDocument());
    screen.getByText('metrics.viewBenchmark').click();
    await waitFor(() => expect(screen.getByText('av1')).toBeInTheDocument());
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('benchmark=true'))).toBe(true);
  });

  it('shows the video title and source in benchmark view', async () => {
    const benchRun = {
      ...sampleRun, benchmark: true,
      clip: 'original_dataset/beauty-medium-001.mp4',
      sourceWidth: 1920, sourceHeight: 1080, sourceDurationSeconds: 31, sourceCodec: 'vp9',
      renditions: [{ ...sampleRun.renditions[0], codec: 'av1', width: 1280, height: 720 }],
    };
    global.fetch = (jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [benchRun] }) })) as unknown as typeof fetch;

    render(<TranscodeMetrics />);
    await waitFor(() => expect(screen.getByText('metrics.empty')).toBeInTheDocument());
    screen.getByText('metrics.viewBenchmark').click();
    await waitFor(() => expect(screen.getByText('beauty-medium-001')).toBeInTheDocument());
    expect(screen.getByText('1920×1080 · 31s · vp9')).toBeInTheDocument();
  });

  it('benchmark view groups by video with one row per run incl output size and date', async () => {
    const mk = (machine: string, codec: string, sizeBytes: number) => ({
      ...sampleRun, id: `run-${machine}`, benchmark: true, clip: 'original_dataset/beauty-medium-001.mp4',
      machineLabel: machine, completedAt: '2026-06-10T12:00:00Z', repetition: 1,
      sourceWidth: 1920, sourceHeight: 1080, sourceDurationSeconds: 31, sourceCodec: 'vp9',
      renditions: [{ ...sampleRun.renditions[0], codec, width: 1280, height: 720,
        elapsedSeconds: 12, outputBitrateKbps: 2950, avgCpuPercent: 180, outputFileSizeBytes: sizeBytes }],
    });
    const fetchMock2 = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [mk('c5.xlarge', 'av1', 1_500_000), mk('c7i.xlarge', 'av1', 1_500_000)] }) });
    global.fetch = fetchMock2 as unknown as typeof fetch;

    render(<TranscodeMetrics />);
    await waitFor(() => expect(screen.getByText('metrics.empty')).toBeInTheDocument());
    screen.getByText('metrics.viewBenchmark').click();
    await waitFor(() => expect(screen.getByText('beauty-medium-001')).toBeInTheDocument());
    expect(screen.getByText('c5.xlarge')).toBeInTheDocument();
    expect(screen.getByText('c7i.xlarge')).toBeInTheDocument();
    expect(screen.getAllByText('1.4 MB').length).toBeGreaterThan(0);
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

  it('benchmark view shows dash for missing outputFileSizeBytes and renders source size when large enough', async () => {
    const noSizeRun = {
      ...sampleRun, benchmark: true, clip: 'clips/test.mp4',
      sourceWidth: 1280, sourceHeight: 720, sourceFileSizeBytes: 2_000_000,
      renditions: [{ ...sampleRun.renditions[0], codec: 'h264', outputFileSizeBytes: undefined }],
    };
    const fetchMock3 = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [noSizeRun] }) });
    global.fetch = fetchMock3 as unknown as typeof fetch;

    render(<TranscodeMetrics />);
    await waitFor(() => expect(screen.getByText('metrics.empty')).toBeInTheDocument());
    screen.getByText('metrics.viewBenchmark').click();
    await waitFor(() => expect(screen.getByText('test')).toBeInTheDocument());
    // source file size >= 1024 bytes should appear in source meta
    expect(screen.getByText(/1\.9 MB/)).toBeInTheDocument();
    // rendition with no outputFileSizeBytes renders dash in the output size column
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('benchmark view handles run with no clip and no repetition', async () => {
    const noClipRun = {
      ...sampleRun, benchmark: true, clip: undefined, repetition: undefined,
      completedAt: 'not-a-date',
      renditions: [{ ...sampleRun.renditions[0], codec: 'av1', outputFileSizeBytes: 500 }],
    };
    const fetchMock4 = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [noClipRun] }) });
    global.fetch = fetchMock4 as unknown as typeof fetch;

    render(<TranscodeMetrics />);
    await waitFor(() => expect(screen.getByText('metrics.empty')).toBeInTheDocument());
    screen.getByText('metrics.viewBenchmark').click();
    // clip title falls back to empty string, source label shows — when no dimensions
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
    // outputFileSizeBytes=500 (<1024) shows in KB
    expect(screen.getByText('0 KB')).toBeInTheDocument();
  });

  it('with sessionId prop → starts in benchmark mode and fetches benchmark=true', async () => {
    const sessionRun = {
      ...sampleRun, id: 'bench-s1', sessionId: 's1', benchmark: true,
      clip: 'bench/session-video.mp4',
      renditions: [{ ...sampleRun.renditions[0], codec: 'av1', width: 1280, height: 720 }],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ runs: [sessionRun] }),
    }) as unknown as typeof fetch;

    render(<TranscodeMetrics sessionId="s1" />);
    // Should immediately show benchmark data (av1) without requiring a toggle click
    await waitFor(() => expect(screen.getByText('av1')).toBeInTheDocument());
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('benchmark=true');
  });

  it('benchmark view shows dash for zero outputFileSizeBytes and missing completedAt', async () => {
    const zeroSizeRun = {
      ...sampleRun, benchmark: true, clip: 'clips/zero.mp4',
      sourceWidth: 1920, sourceHeight: 1080,
      completedAt: undefined as unknown as string,
      renditions: [{ ...sampleRun.renditions[0], codec: 'hevc', outputFileSizeBytes: 0 }],
    };
    const fetchMock5 = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [zeroSizeRun] }) });
    global.fetch = fetchMock5 as unknown as typeof fetch;

    render(<TranscodeMetrics />);
    await waitFor(() => expect(screen.getByText('metrics.empty')).toBeInTheDocument());
    screen.getByText('metrics.viewBenchmark').click();
    await waitFor(() => expect(screen.getByText('zero')).toBeInTheDocument());
    // outputFileSizeBytes=0 should render — (humanSize guard)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
