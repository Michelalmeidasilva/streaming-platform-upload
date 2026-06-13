/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import DistributionMetrics from '../DistributionMetrics';

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useI18n: () => ({ t: (k: string) => k, locale: 'en' }),
}));

jest.mock('@/components/LoadingSpinner', () => {
  function MockLoadingSpinner() { return <div data-testid="loading-spinner" />; }
  return MockLoadingSpinner;
});

const sampleRun = {
  id: 2,
  tier: 'T1',
  n_viewers: 2,
  protocol: 'hls',
  machine: 'local',
  asset_id: 'a',
  started_at: '2026-06-13T11:40:34-03:00',
  qoe: [
    {
      RunID: 2,
      PlayerEngine: 'gpac',
      Samples: 1,
      StartupP50MS: 100,
      StartupP95MS: 150,
      RebufferRatioAvg: 0,
      BitrateAvgKbps: 2800,
    },
    {
      RunID: 2,
      PlayerEngine: 'shaka',
      Samples: 3,
      StartupP50MS: 120,
      StartupP95MS: 160,
      RebufferRatioAvg: 0.01,
      BitrateAvgKbps: 2600,
    },
  ],
};

const sampleProjection = {
  basis: 'T1=1',
  n_target: 1000000,
  egress_gb_h: 1260000,
  agg_rps: 100000,
  connections: 5000,
  cost_usd_month: 78347712,
  saturation_tier: 'lambda',
};

describe('DistributionMetrics', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('shows loading spinner while fetching', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    render(<DistributionMetrics />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows error state when fetch rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    render(<DistributionMetrics />);
    await waitFor(() => expect(screen.getByText('distribution.error')).toBeInTheDocument());
  });

  it('shows error state when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    render(<DistributionMetrics />);
    await waitFor(() => expect(screen.getByText('distribution.error')).toBeInTheDocument());
  });

  it('shows empty state when runs array is empty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [], projections: [] }),
    }) as unknown as typeof fetch;
    render(<DistributionMetrics />);
    await waitFor(() => expect(screen.getByText('distribution.empty')).toBeInTheDocument());
  });

  it('renders run rows for gpac and shaka engines', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [sampleRun], projections: [sampleProjection] }),
    }) as unknown as typeof fetch;

    render(<DistributionMetrics />);
    await waitFor(() => expect(screen.getByText('gpac')).toBeInTheDocument());
    expect(screen.getByText('shaka')).toBeInTheDocument();
    // tier
    expect(screen.getAllByText('T1').length).toBeGreaterThan(0);
    // machine
    expect(screen.getAllByText('local').length).toBeGreaterThan(0);
    // startup for gpac
    expect(screen.getByText('100')).toBeInTheDocument();
    // samples
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders projections table', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [sampleRun], projections: [sampleProjection] }),
    }) as unknown as typeof fetch;

    render(<DistributionMetrics />);
    await waitFor(() => expect(screen.getByText('distribution.projections')).toBeInTheDocument());
    expect(screen.getByText('lambda')).toBeInTheDocument();
  });

  it('renders dash fallback row when run has empty qoe', async () => {
    const runNoQoe = { ...sampleRun, qoe: [] };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [runNoQoe], projections: [] }),
    }) as unknown as typeof fetch;

    render(<DistributionMetrics />);
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
    // Still renders the tier
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('does not render projections section when projections is empty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [sampleRun], projections: [] }),
    }) as unknown as typeof fetch;

    render(<DistributionMetrics />);
    await waitFor(() => expect(screen.getByText('gpac')).toBeInTheDocument());
    expect(screen.queryByText('distribution.projections')).toBeNull();
  });
});
