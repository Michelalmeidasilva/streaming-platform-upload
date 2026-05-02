# Phase 1: Google authentication with secure ADMIN/MEMBER roles - Research

**Gathered:** 2026-05-01
**Status:** Ready for planning
**Mode:** ecosystem

## Standard Stack

- Use [Auth.js / NextAuth](https://authjs.dev/) for the authentication library.
- Use the Google OAuth provider from Auth.js and keep Google as the only sign-in provider in this phase.
- Use Next.js App Router route handlers for auth callbacks and protected APIs.
- Use a client `SessionProvider` only for UI state; do not use client context as a security boundary.
- Use server-side session helpers in route handlers, server components, and middleware/proxy-style checks.
- Use a server-side allowlist to assign `ADMIN`; default every other authenticated user to `MEMBER`.

## Architecture Patterns

### 1. Centralize auth and authorization in a server-only data access layer

Next.js recommends centralizing data access and authorization logic so checks are consistent and less error-prone. That matters here because the phase spans route handlers, upload flows, download flows, and the page shell. Put session lookup and role resolution in a `server-only` helper and reuse it everywhere.

### 2. Treat route handlers as public-facing endpoints

Next.js explicitly says route handlers must be treated like public APIs and must verify whether the user is allowed to access them. For this phase, every `GET`, `PATCH`, `DELETE`, upload, and download route must authorize independently. Do not rely on the UI or the page shell.

### 3. Use optimistic UI checks only for hiding controls

Next.js separates optimistic checks from secure checks. Hiding upload/edit/delete buttons in the client is fine, but all meaningful enforcement must happen on the server. Client checks should only improve UX.

### 4. Keep auth state on the server, not in local storage

Next.js auth guidance recommends server-set cookies with `httpOnly`, `secure`, `sameSite`, `path`, and expiration options. For this phase, the session should be stored in secure cookies managed by the auth library, and role checks should read from server session state.

### 5. Use middleware for coarse gating and throttling, not as the only guard

Middleware can be used to short-circuit obvious unauthorized or abusive requests, but route handlers still need their own checks. Middleware should be treated as a first line of defense and a rate-limit entry point, not the only authorization boundary.

### 6. Return minimal DTOs

Video listing and download endpoints should return only the fields needed by the client. Avoid exposing raw storage keys, internal IDs, session details, or broad metadata that the UI does not need.

## Don't Hand-Roll

- Do not build a custom client-side auth system with roles stored in React state or local storage.
- Do not trust any role value sent from the browser.
- Do not expose raw storage URLs or bucket paths unless the server has already authorized the request.
- Do not hide edit/delete controls without also enforcing `403` server-side.
- Do not implement a route-wide "authenticated once, trusted everywhere" shortcut.
- Do not assume rate limiting belongs only at the edge; protect the auth and video routes at the application level too.
- Do not hand-roll cryptography or token validation.
- Do not keep secrets outside server-only helpers.

## Common Pitfalls

- Client-only auth checks give a false sense of security because nested routes and route handlers can still be reached directly.
- Using only the page shell to block access does not protect APIs.
- Returning raw S3/MinIO URLs from `/api/videos` leaks direct object access.
- Missing a protected `download` route creates a common bypass for users who can view but should not fetch raw media without authorization.
- A `MEMBER` role must be able to search and view, but not upload, edit, or delete.
- An `ADMIN` role must be more than a hidden UI toggle; the server must enforce the privilege boundary.
- Rate limiting should be route-specific, because auth callbacks, search, and upload completion have different abuse profiles.
- CSP and other security headers are easiest to get right when they are defined centrally in `next.config.js`.

## Current Codebase Observations

- The app currently has no auth system.
- `src/app/api/videos/route.ts` fetches video metadata from the event gateway and signs thumbnail URLs, but it is publicly callable.
- `src/components/UploadArea.tsx` currently lets any user initiate uploads.
- `src/components/VideoList.tsx` currently exposes delete behavior in the UI, but there is no matching protected delete route in `src/app/api/videos/[videoId]/route.ts`.
- `src/app/api/upload/route.ts` and `src/app/api/upload/complete/route.ts` currently accept uploads without authorization.
- The phase therefore needs both a new auth boundary and new route-level authorization enforcement.

## Recommended Implementation Shape

- `src/lib/auth/session.ts`
  - Resolve the current session.
  - Normalize the user role to `ADMIN` or `MEMBER`.
  - Keep allowlist logic on the server.

- `src/lib/auth/permissions.ts`
  - Export a narrow permission matrix.
  - Use functions such as `canViewVideo`, `canSearchVideos`, `canDownloadVideo`, `canUploadVideo`, `canEditVideo`, and `canDeleteVideo`.

- `src/middleware.ts`
  - Enforce fast rejection for obvious unauthenticated or abusive requests.
  - Rate limit sensitive auth and video routes.

- `src/app/api/videos/[videoId]/route.ts`
  - Support admin-only edit and delete.
  - Return `401` when there is no session and `403` when the role is insufficient.

- `src/app/api/videos/[videoId]/download/route.ts`
  - Authorize before producing any time-limited playback/download access.

- `src/app/providers.tsx`
  - Provide session context to the client shell only.
  - Use it for visibility, not security.

## Verification Focus

- `401` for unauthenticated access.
- `403` for forbidden role access.
- `429` for abusive or repeated sensitive requests.
- Secure cookies on the session boundary.
- No raw storage URLs in unauthorized responses.
- Admin-only mutation behavior on the video APIs.

## Sources

- [Auth.js homepage](https://authjs.dev/)
- [Auth.js example: server-side session access with `auth()`](https://nextjs-docker-example.authjs.dev/server-example)
- [Auth.js example: client-side `SessionProvider` usage](https://nextjs-docker-example.authjs.dev/client-example)
- [Google OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js data security guide](https://nextjs.org/docs/app/guides/data-security)
- [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy)
- [Next.js `headers` configuration](https://nextjs.org/docs/pages/api-reference/config/next-config-js/headers)
- [OWASP Denial of Service cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
