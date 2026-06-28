/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import TranscodeMetrics from "../TranscodeMetrics";

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useI18n: () => ({ t: (k: string) => k, locale: 'en' }),
}));

const baseRendition = {
  name: 'h264-720p', codec: 'h264', width: 1280, height: 720, preset: 'veryfast',
  targetBitrateKbps: 3000, outputBitrateKbps: 2950, elapsedSeconds: 20,
  avgCpuPercent: 180, maxCpuPercent: 320, avgMemoryMb: 150, maxMemoryMb: 220,
};

function makeRun(sessionId: string, machineLabel: string) {
  return {
    id: `run-${machineLabel}`, sessionId, machineLabel,
    completedAt: '2026-01-01T00:00:00Z', clip: 'bench/video.mp4',
    renditions: [baseRendition],
  };
}

it("com sessionId, mostra só os runs daquela sessão", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ runs: [makeRun("s1", "c5.xlarge"), makeRun("s2", "g6.xlarge")] }),
  }) as any;

  render(<TranscodeMetrics sessionId="s1" />);
  expect(await screen.findByText("c5.xlarge")).toBeInTheDocument();
  expect(screen.queryByText("g6.xlarge")).not.toBeInTheDocument();
});
