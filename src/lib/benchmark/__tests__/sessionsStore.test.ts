import { recordLaunchedSession, listLaunchedSessions } from "../sessionsStore";

beforeEach(() => {
  process.env.INGEST_PERSISTENCE_BASE_URL = "http://ingest:8080/api/v1";
});

afterEach(() => {
  (global.fetch as jest.Mock)?.mockRestore?.();
});

it("recordLaunchedSession POSTa o payload correto para /benchmark-sessions", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  }) as unknown as typeof fetch;

  await recordLaunchedSession({
    sessionId: "s1",
    instanceTypes: ["c5.xlarge", "g6.xlarge"],
    requestedBy: "a@x.com",
  });

  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe("http://ingest:8080/api/v1/benchmark-sessions");
  expect(opts.method).toBe("POST");
  expect(JSON.parse(opts.body)).toEqual({
    sessionId: "s1",
    instanceTypes: ["c5.xlarge", "g6.xlarge"],
    requestedBy: "a@x.com",
  });
});

it("recordLaunchedSession lança erro se ingest responde não-ok", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 503,
  }) as unknown as typeof fetch;

  await expect(
    recordLaunchedSession({ sessionId: "s2", instanceTypes: ["c5.xlarge"], requestedBy: "b@x.com" })
  ).rejects.toThrow("503");
});

it("listLaunchedSessions retorna a lista do ingest", async () => {
  const sessions = [
    { sessionId: "s1", instanceTypes: ["c5.xlarge"], requestedBy: "a@x.com" },
  ];
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sessions }),
  }) as unknown as typeof fetch;

  const result = await listLaunchedSessions();

  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
    "http://ingest:8080/api/v1/benchmark-sessions"
  );
  expect(result).toEqual(sessions);
});

it("listLaunchedSessions retorna [] se sessions ausente no corpo", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  }) as unknown as typeof fetch;

  const result = await listLaunchedSessions();
  expect(result).toEqual([]);
});

it("listLaunchedSessions lança erro se ingest responde não-ok", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 502,
  }) as unknown as typeof fetch;

  await expect(listLaunchedSessions()).rejects.toThrow("502");
});
