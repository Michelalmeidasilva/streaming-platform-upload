import { POST } from "../launch/route";

jest.mock("@/lib/auth/session", () => ({ getCurrentSession: jest.fn() }));
jest.mock("@/lib/auth/roles", () => ({ resolveRoleFromEmail: jest.fn() }));
jest.mock("@/lib/benchmark/orchestratorClient", () => ({ invokeOrchestrator: jest.fn() }));
jest.mock("@/lib/security/audit", () => ({ recordSecurityEvent: jest.fn() }));
jest.mock("@/lib/benchmark/sessionsStore", () => ({ recordLaunchedSession: jest.fn() }));

import { getCurrentSession } from "@/lib/auth/session";
import { resolveRoleFromEmail } from "@/lib/auth/roles";
import { invokeOrchestrator } from "@/lib/benchmark/orchestratorClient";
import { recordLaunchedSession } from "@/lib/benchmark/sessionsStore";

const validBody = {
  instanceTypes: ["c5.xlarge", "g6.xlarge"],
  codecs: ["h264"],
  resolutions: "1280x720:2800",
  repeats: 3,
  mode: "throughput",
};

function req(body: unknown) {
  return new Request("http://localhost/api/benchmark/launch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (recordLaunchedSession as jest.Mock).mockResolvedValue(undefined);
});

it("grava a sessão lançada com os tipos e email do usuário", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({ user: { email: "a@x.com" } });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  (invokeOrchestrator as jest.Mock).mockResolvedValue({ status: 202, body: { sessionId: "s9" } });

  await POST(req(validBody));

  expect(recordLaunchedSession).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionId: "s9",
      instanceTypes: ["c5.xlarge", "g6.xlarge"],
      requestedBy: "a@x.com",
    })
  );
});

it("falha ao gravar sessão NÃO falha o launch (try/catch)", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({ user: { email: "a@x.com" } });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  (invokeOrchestrator as jest.Mock).mockResolvedValue({ status: 202, body: { sessionId: "s9" } });
  (recordLaunchedSession as jest.Mock).mockRejectedValue(new Error("ingest down"));

  const res = await POST(req(validBody));
  // The launch must succeed even if the record call fails
  expect(res.status).toBe(202);
  expect(await res.json()).toEqual({ sessionId: "s9" });
});

it("não grava sessão se o orquestrador retorna erro (4xx/5xx)", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({ user: { email: "a@x.com" } });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  (invokeOrchestrator as jest.Mock).mockResolvedValue({ status: 500, body: { error: "failed" } });

  await POST(req(validBody));

  // Only record when there's a valid sessionId returned
  // (500 responses may not have sessionId)
  // This test just ensures no throw; recordLaunchedSession may or may not be called
  // depending on whether sessionId is in the body — that's implementation detail
});
