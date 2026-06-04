// Single source of truth for the maximum upload file size.
//
// The limit defaults to 5 GB and can be raised via env. Because the same value
// is enforced on the server (API route) and on the client (CMAF validation in
// the browser bundle), it is exposed through two env vars:
//   - UPLOAD_MAX_FILE_SIZE_GB            — server-only
//   - NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB — inlined into the client bundle
// The server var takes precedence; the public var is the client fallback.
// Both names are referenced literally so Next.js can statically inline the
// NEXT_PUBLIC_ value at build time.

const DEFAULT_MAX_FILE_SIZE_GB = 5;
const BYTES_PER_GB = 1024 * 1024 * 1024;

export function getMaxFileSizeGB(): number {
  const raw =
    process.env.UPLOAD_MAX_FILE_SIZE_GB ??
    process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_GB;

  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_FILE_SIZE_GB;
}

export function getMaxFileSizeBytes(): number {
  return getMaxFileSizeGB() * BYTES_PER_GB;
}
