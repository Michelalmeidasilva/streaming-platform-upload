# Roadmap

## Completed Milestone

### Phase 1: Google authentication with secure ADMIN/MEMBER roles

**Depends on:** None
**Goal:** Design and implement a security-focused authentication and authorization system using Google sign-in with role-based access for `ADMIN` and `MEMBER`.
**Requirements:** [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07]
**Success Criteria:**
1. Google sign-in creates a server-verified session.
2. Members can view, search, and download videos, but cannot upload, edit, or delete.
3. Admins can upload, edit, delete, view, search, and download videos.
4. Protected routes reject unauthorized access with 401/403 responses.
5. Sensitive endpoints are rate limited and emit 429 on abuse.
**Plans:** 1 plan

Plans:
- [x] 01-01: Google auth, role enforcement, and security controls

### Phase 2: Security principles and controls for confidentiality, integrity, and availability

**Depends on:** Phase 1
**Goal:** Add security controls that protect sensitive data, preserve data integrity, and keep the platform available for authorized users.
**Requirements:** [SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06]
**Success Criteria:**
1. Sensitive information is protected with encryption and access controls.
2. Data integrity is protected with verification and tamper-resistant handling.
3. Authorized users retain reliable access through redundancy and backup-oriented controls.
4. Security expectations are documented for future implementation phases.
**Plans:** 1 plan

Plans:
- [x] 02-01: Storage encryption, integrity checks, and recovery controls
