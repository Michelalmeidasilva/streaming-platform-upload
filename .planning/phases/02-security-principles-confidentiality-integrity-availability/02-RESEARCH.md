# Phase 2: Security principles and controls for confidentiality, integrity, and availability - Research

**Gathered:** 2026-05-01
**Status:** Ready for planning
**Mode:** ecosystem

## Standard Stack

- Use provider-managed storage encryption for data at rest instead of custom encryption code.
- Use AWS S3 server-side encryption (`SSE-S3` or `SSE-KMS`) for production buckets.
- Use MinIO/S3-compatible defaults in local development, but keep the same application contract.
- Use S3 checksum support to verify upload and download integrity.
- Use S3 versioning and backup/replication controls for recoverability and accidental delete protection.
- Use IAM/bucket policies and server-side route authorization for access control.
- Use centralized security headers and server-side rate limiting as availability and abuse controls in the application layer.

## Architecture Patterns

### 1. Confidentiality belongs in layers

OWASP emphasizes defense in depth: encrypted storage should still be protected by access control. For this app, confidentiality should be enforced by both storage controls and application authorization:

- encrypted objects in S3/MinIO
- signed URLs with short lifetimes
- server-side role checks before download or listing
- least-privilege bucket access

### 2. Integrity should be verified at upload time, not after a breach

Amazon S3 supports checksum-based integrity verification during upload and download. For multipart uploads, use checksum support instead of relying only on `ETag`, because `ETag` is not a reliable integrity signal for all encryption and multipart cases.

### 3. Availability is an architecture property, not a UI feature

Availability should be protected with:

- rate limiting on expensive or sensitive endpoints
- request size and upload size limits
- versioning and restore support for object data
- backup or replication strategy for production objects
- graceful fallback behavior when thumbnails or derived assets are unavailable

### 4. Authorization should use server-side policies, not bucket public access

S3 bucket policies and IAM policies should control which app identities can access storage. The app should never depend on public buckets for user access. User-facing access should always flow through the server.

### 5. Metadata and derived assets are part of the security surface

Thumbnails, fallback images, and video metadata can leak sensitive information. Apply the same access checks to derived assets and their URLs. If a user cannot access the video, they should not get the thumbnail or fallback file either.

## Don't Hand-Roll

- Do not implement custom encryption algorithms.
- Do not invent ad hoc digital signature schemes for object protection.
- Do not rely on `ETag` alone as a universal integrity proof.
- Do not expose public bucket URLs for direct playback or downloads.
- Do not use local storage or client state for authorization or access tokens.
- Do not create a "security" control that only hides UI elements.
- Do not assume backups substitute for access control.
- Do not treat availability as purely a storage concern; protect the API surface too.

## Common Pitfalls

- S3 objects are encrypted by default in modern AWS buckets, but app code still needs explicit access control and key-management posture.
- SSE-S3 and SSE-KMS are server-side encryption strategies, not authorization mechanisms.
- S3 checksum support is the right tool for integrity verification during upload/download.
- Versioning helps recover overwritten or deleted objects, but it does not replace backups or replication planning.
- Cross-region replication and AWS Backup can support disaster recovery and retention, but they must be designed around restore expectations and encryption constraints.
- Rate limiting is one of the simplest availability controls and should be applied to auth, upload, and download flows separately.
- File upload protections should include extension validation, content-type validation, filename safety, and upload/download limits.

## Current Codebase Observations

- `src/lib/storage/S3Adapter.ts` and `src/lib/storage/MinIOAdapter.ts` currently support multipart uploads and signed URLs.
- The app currently relies on storage adapters but does not yet standardize a security posture for encryption, checksums, versioning, or backup strategy.
- The event gateway and upload routes are currently more focused on functionality than on explicit security controls.
- The repository already has auth and rate-limit work planned in Phase 1; Phase 2 should build on those boundaries, not duplicate them.

## Recommended Implementation Shape

- `src/lib/security/storage-policy.ts`
  - Define the storage security posture: encryption mode, checksum algorithm, object retention, and backup expectations.

- `src/lib/storage/S3Adapter.ts`
  - Pass encryption settings when creating uploads.
  - Prefer checksum-capable upload options where the SDK supports them.
  - Keep download access signed and time limited.

- `src/lib/storage/MinIOAdapter.ts`
  - Mirror the same application-level security contract even when the backend is local MinIO.
  - Keep local defaults safe enough for testing without weakening production assumptions.

- `src/app/api/videos/route.ts`
  - Return only data that the current user is allowed to see.
  - Avoid leaking inaccessible derived assets.

- `src/middleware.ts`
  - Apply availability controls such as rate limiting and route classification.

- `docs/security/`
  - Document confidentiality, integrity, and availability decisions so future phases inherit them.

## Verification Focus

- Objects are encrypted at rest using provider-managed encryption in production.
- Uploads are checksum-verified rather than trusting client-side bytes blindly.
- Versioning or restore strategy exists for accidental overwrite/delete recovery.
- Sensitive routes remain protected by server-side authorization.
- Availability controls include rate limits and request limits.
- Derived assets are covered by the same access policy as the original video.

## Sources

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [AWS S3 encryption overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-files-encryption.html)
- [AWS S3 SSE-KMS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html)
- [AWS S3 checksum integrity](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html)
- [AWS S3 upload integrity checks](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html)
- [AWS S3 versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/versioning-workflows.html)
- [AWS Backup for S3](https://docs.aws.amazon.com/aws-backup/latest/devguide/s3-backups.html)
- [AWS S3 replication tutorial](https://docs.aws.amazon.com/hands-on/latest/replicate-data-using-amazon-s3-replication/replicate-data-using-amazon-s3-replication.html)
- [Next.js data security guide](https://nextjs.org/docs/app/guides/data-security)
- [OWASP Denial of Service cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)

