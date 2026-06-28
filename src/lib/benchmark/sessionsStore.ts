// Persiste/recupera metadados de sessões de benchmark via o ingest (cliente HTTP).

import { ingestBaseUrl } from "./ingestBase";

export interface LaunchedSession {
  sessionId: string;
  instanceTypes: string[];
  requestedBy: string;
}

/** POST /api/v1/benchmark-sessions — persiste sessão lançada no ingest. */
export async function recordLaunchedSession(s: LaunchedSession): Promise<void> {
  const url = `${ingestBaseUrl()}/benchmark-sessions`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
  if (!resp.ok) {
    throw new Error(`Ingest respondeu ${resp.status} ao gravar sessão lançada`);
  }
}

/** GET /api/v1/benchmark-sessions — lista sessões lançadas do ingest. */
export async function listLaunchedSessions(): Promise<LaunchedSession[]> {
  const url = `${ingestBaseUrl()}/benchmark-sessions`;
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Ingest respondeu ${resp.status} ao listar sessões lançadas`);
  }
  const body = (await resp.json()) as { sessions?: LaunchedSession[] };
  return body.sessions ?? [];
}
