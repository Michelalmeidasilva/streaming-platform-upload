import { GET } from "../sessions/route";

jest.mock("@/lib/auth/session", () => ({ getCurrentSession: jest.fn() }));
jest.mock("@/lib/auth/roles", () => ({ resolveRoleFromEmail: jest.fn() }));
jest.mock("@/lib/security/audit", () => ({ recordSecurityEvent: jest.fn() }));

import { getCurrentSession } from "@/lib/auth/session";
import { resolveRoleFromEmail } from "@/lib/auth/roles";
import { recordSecurityEvent } from "@/lib/security/audit";

beforeEach(() => {
  jest.clearAllMocks();
  process.env.INGEST_PERSISTENCE_BASE_URL = "http://ingest:8080/api/v1";
});

afterEach(() => {
  (global.fetch as jest.Mock)?.mockRestore?.();
});

function mockFetch(runs: unknown[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ runs }),
  }) as unknown as typeof fetch;
}

const now = new Date("2025-01-15T12:00:00.000Z").getTime();

it("401 sem sessão", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue(null);
  const res = await GET();
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: "Não autenticado." });
});

it("403 para MEMBER + audit", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({
    user: { email: "member@x.com" },
  });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("MEMBER");
  const res = await GET();
  expect(res.status).toBe(403);
  expect(recordSecurityEvent).toHaveBeenCalledWith(
    expect.objectContaining({ type: "access_denied", email: "member@x.com" })
  );
});

it("200 vazio quando não há runs com sessionId", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({
    user: { email: "admin@x.com" },
  });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  mockFetch([
    { machineLabel: "c5.xlarge", completedAt: "2025-01-01T00:00:00Z" }, // sem sessionId
  ]);

  const res = await GET();
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.sessions).toEqual([]);
});

it("200 agrupa por sessionId e reconcilia (complete)", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({
    user: { email: "admin@x.com" },
  });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");

  const completedAt = "2025-01-15T10:00:00.000Z";
  mockFetch([
    { machineLabel: "c5.xlarge", completedAt, sessionId: "sess-1" },
    { machineLabel: "g6.xlarge", completedAt, sessionId: "sess-1" },
    { machineLabel: "c5.xlarge", completedAt: "2025-01-14T08:00:00.000Z", sessionId: "sess-2" },
  ]);

  const res = await GET();
  expect(res.status).toBe(200);
  const body = await res.json();

  // Two distinct sessions
  expect(body.sessions).toHaveLength(2);

  // sess-1 first (more recent)
  const s1 = body.sessions.find((s: { sessionId: string }) => s.sessionId === "sess-1");
  expect(s1).toBeDefined();
  // launchedTypes === reportedLabels (Task 4 derivation) → complete
  expect(s1.status).toBe("complete");
  expect(s1.reported).toBe(2);
  expect(s1.total).toBe(2);

  const s2 = body.sessions.find((s: { sessionId: string }) => s.sessionId === "sess-2");
  expect(s2).toBeDefined();
  expect(s2.reported).toBe(1);
});

it("502 quando ingest falha", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({
    user: { email: "admin@x.com" },
  });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 503,
  }) as unknown as typeof fetch;

  const res = await GET();
  expect(res.status).toBe(502);
  const body = await res.json();
  expect(body.error).toMatch(/Falha/);
});

it("502 quando fetch lança exceção", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({
    user: { email: "admin@x.com" },
  });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  global.fetch = jest
    .fn()
    .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

  const res = await GET();
  expect(res.status).toBe(502);
});

it("chama ingest com benchmark=true", async () => {
  (getCurrentSession as jest.Mock).mockResolvedValue({
    user: { email: "admin@x.com" },
  });
  (resolveRoleFromEmail as jest.Mock).mockReturnValue("ADMIN");
  mockFetch([]);

  await GET();
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
    "benchmark=true"
  );
});
