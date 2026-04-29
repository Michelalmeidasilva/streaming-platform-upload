# Docker Setup for streaming-platform-upload

This service uses the **centralized infrastructure** defined in the root `infra/` directory.

## Prerequisites

The infrastructure (MinIO) must be running before starting this service.

### Start the Centralized Infrastructure

```bash
cd ../../infra
docker compose up -d
```

Verify all services are healthy:
```bash
make ps
make test-all
```

## Running streaming-platform-upload

### Option 1: Run Locally with Node.js (Recommended for Development)

```bash
# Set environment variables
export STORAGE_PROVIDER=minio
export STORAGE_BUCKET=videos
export MINIO_ENDPOINT=http://localhost:9000
export MINIO_ACCESS_KEY=admin
export MINIO_SECRET_KEY=password123

# Install and run
npm install
npm run dev
```

The app will be available at http://localhost:3000

### Option 2: Run with Docker

```bash
# From the root infra directory
cd ../../infra
docker compose up -d

# From this directory (streaming-platform-upload)
docker build -t streaming-platform-upload .
docker run --network vod-network \
  -e STORAGE_PROVIDER=minio \
  -e STORAGE_BUCKET=videos \
  -e MINIO_ENDPOINT=http://minio:9000 \
  -e MINIO_ACCESS_KEY=admin \
  -e MINIO_SECRET_KEY=password123 \
  -p 3000:3000 \
  streaming-platform-upload
```

## Configuration

All environment variables are documented in `../../infra/.env.example`

Key variables for this service:
- `STORAGE_PROVIDER` - Storage backend (minio, s3, etc)
- `STORAGE_BUCKET` - S3 bucket name
- `MINIO_ENDPOINT` - MinIO S3 endpoint
- `MINIO_ACCESS_KEY` - MinIO credentials
- `MINIO_SECRET_KEY` - MinIO credentials

## Docker Network

When running in Docker, this service connects to the centralized infrastructure via the `vod-network` Docker network.

Service names on this network:
- `minio` - MinIO object storage

## Troubleshooting

If the service can't connect to storage:

1. **Verify infrastructure is running**:
   ```bash
   cd ../../infra && make ps
   ```

2. **Check network connectivity**:
   ```bash
   docker network ls | grep vod-network
   ```

3. **Verify MinIO bucket exists**:
   ```bash
   cd ../../infra && make reset-buckets
   ```

4. **Check environment variables**:
   ```bash
   env | grep MINIO
   ```

5. **View logs**:
   ```bash
   cd ../../infra && make logs-minio
   # or for the app
   npm run dev  # will show logs in console
   ```

## See Also

- `../../infra/INDEX.md` - Complete infrastructure documentation
- `../../infra/SERVICES_INTEGRATION.md` - Service integration guide
- `./SPEC.md` - API specification for this service
