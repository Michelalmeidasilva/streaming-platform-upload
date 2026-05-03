type StorageProvider = 's3' | 'minio' | 'memory';

interface CompletedVideoPayload {
  key: string;
  size: number;
  occurredAt?: Date;
  multipart?: boolean;
}

function buildWebhookBaseUrl() {
  const explicit = process.env.INGEST_STORAGE_WEBHOOK_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const gateway = process.env.EVENT_GATEWAY_URL?.trim();
  if (!gateway) {
    return null;
  }

  return gateway.replace(/\/events$/, '').replace(/\/$/, '');
}

function buildS3Event(payload: CompletedVideoPayload) {
  return {
    Records: [
      {
        eventName: payload.multipart ? 'ObjectCreated:CompleteMultipartUpload' : 'ObjectCreated:Put',
        eventTime: (payload.occurredAt || new Date()).toISOString(),
        s3: {
          object: {
            key: payload.key,
            size: payload.size,
          },
        },
      },
    ],
  };
}

function buildMinioEvent(payload: CompletedVideoPayload) {
  return {
    EventName: payload.multipart ? 's3:ObjectCreated:CompleteMultipartUpload' : 's3:ObjectCreated:Put',
    Key: payload.key,
    Records: [
      {
        eventTime: (payload.occurredAt || new Date()).toISOString(),
        s3: {
          object: {
            key: payload.key,
            size: payload.size,
          },
        },
      },
    ],
  };
}

export async function notifyIngestStorageCompletion(provider: StorageProvider, payload: CompletedVideoPayload) {
  const baseUrl = buildWebhookBaseUrl();
  if (!baseUrl || provider === 'memory') {
    return;
  }

  if (provider !== 's3' && provider !== 'minio') {
    return;
  }

  const normalizedProvider = provider === 's3' ? 'aws-s3' : 'minio';
  const body = provider === 's3' ? buildS3Event(payload) : buildMinioEvent(payload);

  const response = await fetch(`${baseUrl}/webhooks/storage/${normalizedProvider}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to notify ingest storage webhook (${response.status}): ${errorText}`);
  }
}
