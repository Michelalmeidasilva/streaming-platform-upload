import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { resolveRoleFromEmail } from "@/lib/auth/roles";
import { recordSecurityEvent } from "@/lib/security/audit";
import { reconcileSession } from "@/lib/benchmark/sessionStatus";
import { listLaunchedSessions } from "@/lib/benchmark/sessionsStore";

const ROUTE = "/api/benchmark/sessions";
const METHOD = "GET";

/** Mirrors the helper in /api/runs/route.ts — single source: env var. */
function ingestBaseUrl(): string {
  const raw =
    process.env.INGEST_PERSISTENCE_BASE_URL ||
    process.env.EVENT_GATEWAY_URL ||
    "http://localhost:8080/api/v1";
  return raw.replace(/\/$/, "");
}

/**
 * Shape returned by the ingest /runs endpoint for benchmark runs.
 * `sessionId` was added to the ingest schema in Plano 3 (Task 3).
 * It is intentionally absent from the shared TranscodeRun type until a
 * wider refactor; the route deals with the raw response directly.
 */
interface IngestBenchmarkRun {
  machineLabel: string;
  completedAt: string;
  sessionId?: string;
}

/** Fetch all benchmark runs from ingest (no pagination — v1 assumption). */
async function fetchBenchmarkRuns(): Promise<IngestBenchmarkRun[]> {
  const url = `${ingestBaseUrl()}/runs?benchmark=true`;
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Ingest respondeu ${resp.status} para benchmark runs`);
  }
  const body = (await resp.json()) as { runs?: IngestBenchmarkRun[] };
  return body.runs ?? [];
}

/**
 * Group benchmark runs by sessionId and reconcile each session's status.
 *
 * NOTE (Task 5): `launchedTypes` is derived from reported machineLabels
 * (launchedTypes === unique labels that reported). This means sessions with
 * ≥1 result always resolve to "complete". Task 5 will supply the real
 * launched list from a sessions store (persisted at dispatch time), replacing
 * this derivation so "incomplete" and "collecting" work faithfully.
 */
async function listBenchmarkSessions() {
  // Fetch runs and launched-session metadata in parallel.
  const [runs, launchedSessions] = await Promise.all([
    fetchBenchmarkRuns(),
    listLaunchedSessions(),
  ]);

  // Build a lookup: sessionId → launched instanceTypes (source-of-truth from store).
  const launchedMap = new Map<string, string[]>();
  for (const ls of launchedSessions) {
    launchedMap.set(ls.sessionId, ls.instanceTypes);
  }

  // Group runs: sessionId → { labels seen, earliest completedAt timestamp }
  const bySession = new Map<
    string,
    { labels: Set<string>; firstSeen: number }
  >();

  for (const r of runs) {
    if (!r.sessionId) continue;
    const ts = Date.parse(r.completedAt);
    const e = bySession.get(r.sessionId) ?? {
      labels: new Set<string>(),
      firstSeen: Number.isNaN(ts) ? Date.now() : ts,
    };
    e.labels.add(r.machineLabel);
    if (!Number.isNaN(ts)) {
      e.firstSeen = Math.min(e.firstSeen, ts);
    }
    bySession.set(r.sessionId, e);
  }

  const now = Date.now();
  return Array.from(bySession.entries())
    .map(([sessionId, e]) => {
      const reportedLabels = Array.from(e.labels);
      // Use launched types from the store (persisted at dispatch time) for faithful
      // "collecting"/"incomplete" status. Fall back to reportedLabels for legacy
      // sessions that pre-date the store.
      const launchedTypes = launchedMap.get(sessionId) ?? reportedLabels;
      const ageMinutes = (now - e.firstSeen) / 60_000;
      return {
        sessionId,
        firstSeen: new Date(e.firstSeen).toISOString(),
        ...reconcileSession({ launchedTypes, reportedLabels, ageMinutes }),
      };
    })
    .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen)); // most recent first
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const role = resolveRoleFromEmail(session.user.email);
  if (role !== "ADMIN") {
    recordSecurityEvent({
      type: "access_denied",
      route: ROUTE,
      method: METHOD,
      reason: "not_admin",
      status: 403,
      email: session.user.email,
      role,
    });
    return NextResponse.json({ error: "Apenas ADMIN." }, { status: 403 });
  }

  try {
    const sessions = await listBenchmarkSessions();
    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Falha ao ler sessões de benchmark.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
