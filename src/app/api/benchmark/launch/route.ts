import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { resolveRoleFromEmail } from "@/lib/auth/roles";
import { invokeOrchestrator } from "@/lib/benchmark/orchestratorClient";
import { recordSecurityEvent } from "@/lib/security/audit";
import { isSupportedType, MAX_CONCURRENT } from "@/lib/benchmark/catalog";

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

  const result = await invokeOrchestrator({
    instanceTypes: types,
    codecs: body.codecs,
    resolutions: body.resolutions,
    repeats: body.repeats,
    mode: body.mode,
  });

  // Adapted: `type: "auth_success"` (no benchmark-specific type in AuditEventType).
  // `reason` carries the action name; `metadata` field does not exist in AuditEvent.
  recordSecurityEvent({
    type: "auth_success",
    route: ROUTE,
    method: METHOD,
    reason: "benchmark_launch",
    status: result.status,
    email: session.user.email,
    role: "ADMIN",
  });

  return NextResponse.json(result.body, { status: result.status });
}
