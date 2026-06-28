import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { resolveRoleFromEmail } from "@/lib/auth/roles";
import { invokeOrchestrator } from "@/lib/benchmark/orchestratorClient";
import { recordSecurityEvent } from "@/lib/security/audit";
import { isSupportedType, MAX_CONCURRENT } from "@/lib/benchmark/catalog";
import { recordLaunchedSession } from "@/lib/benchmark/sessionsStore";

const ROUTE = "/api/benchmark/launch";
const METHOD = "POST";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const role = resolveRoleFromEmail(session.user.email);
  if (role !== "ADMIN") {
    // Adapted: AuditEvent uses `type: AuditEventType` (not `action`); `access_denied` is the correct type.
    // Required fields: type, route, method, reason, status. No `metadata` field in AuditEvent.
    recordSecurityEvent({
      type: "access_denied",
      route: ROUTE,
      method: METHOD,
      reason: "not_admin",
      status: 403,
      email: session.user.email,
      role,
    });
    return NextResponse.json({ error: "Apenas ADMIN pode disparar benchmarks." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const types: unknown = body?.instanceTypes;
  if (
    !Array.isArray(types) ||
    types.length === 0 ||
    types.length > MAX_CONCURRENT ||
    !types.every((t) => typeof t === "string" && isSupportedType(t))
  ) {
    return NextResponse.json({ error: "instanceTypes inválido (allowlist/teto)." }, { status: 400 });
  }

  let result;
  try {
    result = await invokeOrchestrator({
      instanceTypes: types,
      codecs: body.codecs,
      resolutions: body.resolutions,
      repeats: body.repeats,
      mode: body.mode,
    });

    // Adapted: `type` is "auth_success" if status < 400, else "auth_failure" (downstream failure).
    // `reason` carries the action name; encode instance types and session ID for traceability.
    const auditType = result.status >= 400 ? "auth_failure" : "auth_success";
    recordSecurityEvent({
      type: auditType,
      route: ROUTE,
      method: METHOD,
      reason: `benchmark_launch types=${(types as string[]).join(",")} session=${result.body?.sessionId ?? "unknown"}`,
      status: result.status,
      email: session.user.email,
      role: "ADMIN",
    });

    // Persist the launched session for faithful status reconciliation (Task 5).
    // Non-blocking: a record failure must NOT abort a successful launch.
    if (result.body?.sessionId) {
      try {
        await recordLaunchedSession({
          sessionId: result.body.sessionId as string,
          instanceTypes: types as string[],
          requestedBy: session.user.email,
        });
      } catch (recordErr) {
        console.error(
          "recordLaunchedSession falhou (launch não é bloqueado):",
          recordErr
        );
      }
    }

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    // Orchestrator call failed; emit failure audit and return 502.
    recordSecurityEvent({
      type: "auth_failure",
      route: ROUTE,
      method: METHOD,
      reason: `benchmark_launch_error types=${(types as string[]).join(",")} ${err instanceof Error ? err.message : String(err)}`,
      status: 502,
      email: session.user.email,
      role: "ADMIN",
    });
    return NextResponse.json({ error: "Falha ao disparar o benchmark." }, { status: 502 });
  }
}
