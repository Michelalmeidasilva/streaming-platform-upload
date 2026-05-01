# Requirements: Streaming Platform Upload

**Defined:** 2026-05-01
**Core Value:** Secure video upload and playback with server-side authorization

## v1 Requirements

### Authentication and Roles

- [ ] **AUTH-01**: User can sign in with Google OAuth and receive a server-issued session.
- [ ] **AUTH-02**: Every authenticated user is assigned exactly one role: `ADMIN` or `MEMBER`.
- [ ] **AUTH-03**: `MEMBER` can view videos, search videos, and download videos.
- [ ] **AUTH-04**: `ADMIN` can do everything `MEMBER` can do, plus upload, edit, and delete videos.
- [ ] **AUTH-05**: Protected routes return `401` for unauthenticated requests and `403` for forbidden roles.
- [ ] **AUTH-06**: Sensitive auth and video routes are rate limited and return `429` on abuse.
- [ ] **AUTH-07**: Sessions use secure, httpOnly, sameSite cookies and are verified server-side on each protected request.

## v2 Requirements

### Administration

- **AUTH-08**: Admin role provisioning can be managed without code changes.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Password-based authentication | Phase 1 is Google-first and should avoid extra credential handling. |
| Self-service role escalation | Roles must stay server-controlled for security. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
| AUTH-08 | Phase 2+ | Deferred |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0
