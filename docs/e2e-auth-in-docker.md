# E2E auth in the production-built Docker image

## Problem

The upload platform supports an **E2E auth bypass** for local/dev/CI: a NextAuth
credentials provider (`auth/config.ts`) and an `e2e-session` cookie overlay
(`auth/e2e.ts` → `auth/session.ts`) that turn any email into a session, so tests
can drive the authenticated UI without Google OAuth.

In the Docker image the bypass was **dead**: every authenticated route returned
`401 Unauthorized` (`reason: missing_session`) even with `E2E_AUTH_ENABLED=1` and
a valid `e2e-session` cookie. Google OAuth is the only other provider and is
unusable locally, so the dockerized upload UI could not be authenticated at all.

## Root cause

`isE2EAuthEnabled()` was:

```ts
if (process.env.NODE_ENV === 'production') return false;
return process.env.E2E_AUTH_ENABLED === '1';
```

Next.js / webpack **freeze `process.env.NODE_ENV` at build time**. The optimized
standalone image is built with `NODE_ENV=production`, so the comparison is
compiled to a constant `true` and the function effectively becomes
`return false` — regardless of the runtime `NODE_ENV` (the dev compose runs the
container with `NODE_ENV=development`, but that never reaches this check).

This is not fixable by reading `NODE_ENV` differently: bracket access
(`process.env['NODE_ENV']`) is also folded by the bundler/minifier. NODE_ENV is
simply not a runtime-observable value in the optimized image. (Verified by
inspecting the built bundle and by live testing — both forms returned 401.)

## Fix

Gate **solely** on the explicit, runtime-read `E2E_AUTH_ENABLED` flag:

```ts
export function isE2EAuthEnabled() {
  return process.env.E2E_AUTH_ENABLED === '1';
}
```

`E2E_AUTH_ENABLED` is a normal server env var (not `NEXT_PUBLIC_*`, not
`NODE_ENV`), so it **is** read at runtime in the standalone server. This matches
how `auth/config.ts` already gates the E2E credentials provider — the cookie path
and the credentials path now share one gate.

**Security posture:** unchanged from the app's existing model. The bypass is
off by default and enabled only by an explicit, dangerously-named flag that a
real production deployment must never set. The previous `NODE_ENV` guard added
no real protection in the production-built image (it was build-frozen, not
runtime).

## Local/dev configuration

`infra/docker-compose.yml` sets, on `streaming-platform-upload`:

```yaml
environment:
  E2E_AUTH_ENABLED: "1"
  E2E_ADMIN_EMAIL: admin@local.dev
```

matching the client build args (`NEXT_PUBLIC_E2E_AUTH_ENABLED=1`,
`NEXT_PUBLIC_E2E_ADMIN_EMAIL=admin@local.dev`). Sign in / cookie email
`admin@local.dev` → `ADMIN`.

## Verified

Live E2E (`docker compose`): `POST /api/upload` with `Cookie:
e2e-session=admin@local.dev` now returns `200` (was `401`); the full multipart
flow (init → chunk → complete) completes, the storage webhook fires, the worker
transcodes, and the video reaches `status: ready` and plays in
`streaming-web-client`. Unit contract in `src/lib/auth/__tests__/e2e.test.ts`.
