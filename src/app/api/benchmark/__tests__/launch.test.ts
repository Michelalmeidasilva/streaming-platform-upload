import { POST } from "../launch/route";

jest.mock("@/lib/auth/session", () => ({ getCurrentSession: jest.fn() }));
jest.mock("@/lib/auth/roles", () => ({ resolveRoleFromEmail: jest.fn() }));
jest.mock("@/lib/benchmark/orchestratorClient", () => ({ invokeOrchestrator: jest.fn() }));
jest.mock("@/lib/security/audit", () => ({ recordSecurityEvent: jest.fn() }));
jest.mock("@/lib/benchmark/sessionsStore", () => ({ recordLaunchedSession: jest.fn().mockResolvedValue(undefined) }));

import { getCurrentSession } from "@/lib/auth/session";
import { resolveRoleFromEmail } from "@/lib/auth/roles";
import { invokeOrchestrator } from "@/lib/benchmark/orchestratorClient";
import { recordSecurityEvent } from "@/lib/security/audit";

function req(body: unknown) {
  return new Request("http://localhost/api/benchmark/launch", { method: "POST", body: JSON.stringify(body) });
}
const valid = { instanceTypes: ["c5.xlarge"], codecs: ["h264"], resolutions: "1280x720:2800", repeats: 3, mode: "throughput" };

beforeEach(() => jest.clearAllMocks());

it("401 sem sessão", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue(null);
  const res = await POST(req(valid));
  expect(res.status).toBe(401);
  expect(invokeOrchestrator).not.toHaveBeenCalled();
});

it("403 para MEMBER", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({ user: { email: "u@x.com" } });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("MEMBER");
  const res = await POST(req(valid));
  expect(res.status).toBe(403);
  expect(recordSecurityEvent).toHaveBeenCalledWith(
    expect.objectContaining({ type: "access_denied", email: "u@x.com" })
  );
  expect(invokeOrchestrator).not.toHaveBeenCalled();
});

it("400 para tipo fora da allowlist (ADMIN)", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({ user: { email: "a@x.com" } });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  const res = await POST(req({ ...valid, instanceTypes: ["t2.micro"] }));
  expect(res.status).toBe(400);
  expect(invokeOrchestrator).not.toHaveBeenCalled();
});

it("200 e repassa ao orquestrador para ADMIN com payload válido", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({ user: { email: "a@x.com" } });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  (invokeOrchestrator as jest.Mock).mockResolvedValue({ status: 200, body: { sessionId: "s9" } });
  const res = await POST(req(valid));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ sessionId: "s9" });
  expect(invokeOrchestrator).toHaveBeenCalledWith(expect.objectContaining({ instanceTypes: ["c5.xlarge"] }));
  // Adapted: real AuditEvent uses `type` (not `action`) — using "auth_success" for successful launch
  expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "auth_success" }));
});

it("400 para instanceTypes vazio (ADMIN)", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({ user: { email: "a@x.com" } });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  const res = await POST(req({ ...valid, instanceTypes: [] }));
  expect(res.status).toBe(400);
  expect(invokeOrchestrator).not.toHaveBeenCalled();
});

it("400 para instanceTypes acima do teto (ADMIN)", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({ user: { email: "a@x.com" } });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  // 9 instances exceeds MAX_CONCURRENT (8)
  const res = await POST(
    req({
      ...valid,
      instanceTypes: Array(9).fill("c5.xlarge"),
    })
  );
  expect(res.status).toBe(400);
  expect(invokeOrchestrator).not.toHaveBeenCalled();
});

it("502 quando invokeOrchestrator falha (ADMIN + payload válido)", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({ user: { email: "a@x.com" } });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  (invokeOrchestrator as jest.Mock).mockRejectedValue(new Error("Network timeout"));
  const res = await POST(req(valid));
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ error: "Falha ao disparar o benchmark." });
  expect(recordSecurityEvent).toHaveBeenCalledWith(
    expect.objectContaining({ type: "auth_failure", status: 502, email: "a@x.com" })
  );
});
