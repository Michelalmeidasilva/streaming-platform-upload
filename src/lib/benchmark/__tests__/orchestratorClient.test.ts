/* eslint-disable @typescript-eslint/no-explicit-any */
import { invokeOrchestrator } from "../orchestratorClient";

describe("invokeOrchestrator", () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env, BENCHMARK_ORCHESTRATOR_URL: "https://abc.lambda-url.us-east-2.on.aws/", BENCHMARK_ORCHESTRATOR_REGION: "us-east-2" };
  });
  afterEach(() => { process.env = env; });

  it("assina e faz POST com o corpo, retornando status e json", async () => {
    const calls: any[] = [];
    const fakeFetch = async (url: string, init: any) => {
      calls.push({ url, init });
      return { status: 202, json: async () => ({ sessionId: "s1" }) } as any;
    };
    const fakeSign = async (req: any) => ({ ...req, headers: { ...req.headers, authorization: "AWS4-HMAC..." } });

    const res = await invokeOrchestrator({ instanceTypes: ["c5.xlarge"] }, { fetch: fakeFetch as any, sign: fakeSign });

    expect(res).toEqual({ status: 202, body: { sessionId: "s1" } });
    expect(calls[0].url).toContain("lambda-url");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers.authorization).toContain("AWS4-HMAC");
    expect(JSON.parse(calls[0].init.body)).toEqual({ instanceTypes: ["c5.xlarge"] });
  });

  it("lança se a URL não estiver configurada", async () => {
    delete process.env.BENCHMARK_ORCHESTRATOR_URL;
    await expect(invokeOrchestrator({}, {} as any)).rejects.toThrow();
  });
});
