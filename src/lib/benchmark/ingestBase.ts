/** Shared helper for the ingest API base URL (used by sessions store and routes). */
export function ingestBaseUrl(): string {
  const raw =
    process.env.INGEST_PERSISTENCE_BASE_URL ||
    process.env.EVENT_GATEWAY_URL ||
    "http://localhost:8080/api/v1";
  return raw.replace(/\/$/, "");
}
