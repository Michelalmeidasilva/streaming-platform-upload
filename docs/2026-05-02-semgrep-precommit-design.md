# Design: Add Semgrep to Pre-commit for streaming-platform-upload

**Date:** 2026-05-02
**Service:** streaming-platform-upload (NextJS 14, TypeScript)
**Goal:** Enforce comprehensive security and code quality checks at commit time using custom semgrep rules

## Overview

Integrate semgrep into the pre-commit hook for `streaming-platform-upload` to catch security vulnerabilities, code quality issues, and type safety problems *before* code is committed. This shifts security left by failing fast locally rather than waiting for the pipeline.

## Approach: Custom Rule Configuration

Use **Option B** from the design exploration: create a `.semgrep.yml` configuration file that combines rule sets tailored to Node.js/TypeScript development, then wire it into pre-commit.

## Files to Create/Modify

### 1. Create `streaming-platform-upload/.semgrep.yml`

A custom semgrep configuration that enables:

- **`p/owasp-top-ten`** — Catches OWASP web vulnerabilities: XSS, CSRF, SQL injection, unsafe redirects, insecure deserialization
- **`p/security-audit`** — Flags hardcoded secrets, unsafe cryptography, dangerous patterns (eval, require with variables)
- **`p/typescript`** — Enforces TypeScript type safety: strict null checks, type assertions, unused variables
- **`p/nodejs`** — Node.js and Express-specific issues: unsafe middleware ordering, deprecated APIs, vulnerable package usage patterns

The config will:
- Include all four rule sets via `extends:`
- Exclude test files (`**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/**`) to avoid false positives in test helpers
- Set severity to `ERROR` for all rules (fail-fast on any finding)

### 2. Modify `streaming-platform-upload/.pre-commit-config.yaml`

Add a new hook entry under the existing repos:

```yaml
- repo: https://github.com/returntocorp/semgrep
  rev: v1.45.0
  hooks:
    - id: semgrep
      args: ['--config=.semgrep.yml', '--error']
      types: [ts, tsx, js, json]
      files: ^streaming-platform-upload/
```

**Hook behavior:**
- Runs before every commit (after linting and gitleaks)
- Operates on TypeScript, TSX, JavaScript, and JSON files
- Uses `--config=.semgrep.yml` to apply the custom rule set
- `--error` flag makes the hook fail if any violations are found
- Can be skipped with `git commit --no-verify` if absolutely necessary

## Execution Flow

```
Developer commits code
    ↓
Pre-commit framework runs hooks in order:
  1. trailing-whitespace
  2. end-of-file-fixer
  3. check-yaml
  4. check-added-large-files
  5. gitleaks (secrets detection)
  6. npm-lint (ESLint)
  7. semgrep (SECURITY/TYPE-SAFETY) ← NEW
    ↓
If semgrep finds violations:
  - Hook prints violations to stdout
  - Commit fails (exit code 1)
  - Developer must fix issues and re-stage/commit
    ↓
If no violations:
  - Commit proceeds
  - Code is pushed
```

## Test Verification

After setup, verify the hook works by running:

```bash
cd streaming-platform-upload
pre-commit run semgrep --all-files
```

This will scan all tracked files and report any violations without making a commit. Developers can also test the hook on staged files during normal `git commit`.

## Scope & Constraints

- **Scope:** `streaming-platform-upload` service only (focus request)
- **File types:** TypeScript, TSX, JavaScript, JSON (matches service tech stack)
- **Test files:** Excluded to reduce noise and false positives
- **Failure mode:** Hard fail (blocks commit); can override with `--no-verify`
- **Rule updates:** Maintenance-friendly via centralized `.semgrep.yml` config

## Future Considerations

1. **Pipeline alignment (out of scope):** The existing `.github/workflows/semgrep.yml` can be updated later to use the same `.semgrep.yml` config for consistency.
2. **Rollout to other services:** Once validated in `streaming-platform-upload`, the same pattern can be applied to `streaming-ingest` (Go + gol angci-lint), `streaming-transcode`, and other services.
3. **Custom rules:** If internal patterns (e.g., unsafe use of the storage adapter) need to be enforced, they can be added to `.semgrep.yml` as custom rules.

## Success Criteria

- ✅ Semgrep hook runs automatically before commit
- ✅ Violations block the commit
- ✅ No false positives in test files
- ✅ Hook completes in < 5 seconds on typical changes
- ✅ Documentation in SPEC.md or service docs updated
