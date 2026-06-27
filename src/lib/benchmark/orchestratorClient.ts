import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { HttpRequest } from "@smithy/protocol-http";

interface Deps {
  fetch?: typeof fetch;
  sign?: (req: HttpRequest) => Promise<HttpRequest>;
}

export async function invokeOrchestrator(payload: object, deps: Deps = {}) {
  const url = process.env.BENCHMARK_ORCHESTRATOR_URL;
  if (!url) throw new Error("BENCHMARK_ORCHESTRATOR_URL não configurada.");
  const region = process.env.BENCHMARK_ORCHESTRATOR_REGION ?? "us-east-2";
  const u = new URL(url);
  const body = JSON.stringify(payload);

  const request = new HttpRequest({
    method: "POST",
    protocol: u.protocol,
    hostname: u.hostname,
    path: u.pathname,
    headers: { host: u.hostname, "content-type": "application/json" },
    body,
  });

  const sign =
    deps.sign ??
    ((req: HttpRequest) =>
      new SignatureV4({
        service: "lambda",
        region,
        credentials: defaultProvider(),
        sha256: Sha256,
      }).sign(req));

  const signed = await sign(request);
  const doFetch = deps.fetch ?? fetch;
  const res = await doFetch(url, {
    method: "POST",
    headers: signed.headers as Record<string, string>,
    body,
  });
  return { status: res.status, body: await res.json() };
}
