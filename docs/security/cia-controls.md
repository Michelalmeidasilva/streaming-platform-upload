# CIA Controls

This repository applies the same storage security posture across the upload path, storage adapters, and recovery documentation.

## Confidentiality

- Production storage uses provider-managed encryption with `AES256`.
- Object access stays private. The application only issues signed server-issued access URLs.
- Raw bucket URLs are never exposed as public API responses.

## Integrity

- Uploads use checksum-aware server validation with `SHA256`.
- The storage policy is centralized in `src/lib/security/storage-policy.ts`.
- Upload records carry security posture metadata so the checksum and signing defaults remain auditable.
- The application does not treat `ETag` as the only integrity signal.

## Availability

- Production recovery requires object versioning.
- Recovery also requires a backup target or a replication target for accidental deletion and regional-loss recovery.
- The recovery posture is centralized in `src/lib/security/recovery-policy.ts`.

## Policy Contract

- Default encryption mode: `AES256`
- Default checksum algorithm: `SHA256`
- Default signed URL lifetime: `3600` seconds

## Operational Notes

- `S3Adapter` and `MinIOAdapter` consume the same policy values so local and production behavior stay aligned.
- The upload service attaches the security posture to video and session metadata for auditability.
- Production deploys should set the storage policy environment variables explicitly even though safe defaults exist.
