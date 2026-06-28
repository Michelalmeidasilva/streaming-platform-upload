/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import TranscodeMetrics from "../TranscodeMetrics";

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useI18n: () => ({ t: (k: string) => k, locale: 'en' }),
}));

it("com sessionId, mostra só os runs daquela sessão", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ runs: [
      { sessionId: "s1", machineLabel: "c5.xlarge", renditions: [] },
      { sessionId: "s2", machineLabel: "g6.xlarge", renditions: [] },
    ] }),
  }) as any;

  render(<TranscodeMetrics sessionId="s1" />);
  expect(await screen.findByText("c5.xlarge")).toBeInTheDocument();
  expect(screen.queryByText("g6.xlarge")).not.toBeInTheDocument();
});
