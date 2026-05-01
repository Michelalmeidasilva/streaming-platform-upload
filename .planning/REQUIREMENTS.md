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

### Security Principles

- [ ] **SEC-01**: Video and derived assets are encrypted at rest using provider-managed encryption in production.
- [ ] **SEC-02**: Video upload and download flows verify object integrity with checksums or equivalent server-side validation.
- [ ] **SEC-03**: The storage layer denies direct public access and only serves objects through authorized server-controlled URLs.
- [ ] **SEC-04**: Accidental overwrite or deletion can be recovered through versioning, backup, or replication strategy.
- [ ] **SEC-05**: Sensitive routes remain rate limited and fail safely under repeated abuse.
- [ ] **SEC-06**: Security decisions for confidentiality, integrity, and availability are documented for future implementation phases.

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
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| SEC-03 | Phase 2 | Pending |
| SEC-04 | Phase 2 | Pending |
| SEC-05 | Phase 2 | Pending |
| SEC-06 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0
