# Streaming Platform Upload

A modern video upload service built with **NextJS 14** and **TypeScript**, designed for content creators to upload videos with support for AWS S3 and MinIO storage backends. Built as part of the Video on Demand (VOD) microservices platform.

## Features

- **Multi-part Upload**: Efficient chunked uploads for large video files (up to 2GB)
- **Storage Flexibility**: Support for AWS S3 (production) and MinIO (local development)
- **Event-Driven Architecture**: Decoupled event system for upload lifecycle management
- **Type-Safe**: Full TypeScript support with strict type checking
- **Testing**: Comprehensive Jest unit test suite
- **Code Quality**: ESLint linting and pre-commit validation

## Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker (for local MinIO storage)
- Git

### Installation

1. **Clone the repository and navigate to this service:**
   ```bash
   cd streaming-platform-upload
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` to configure:
   ```
   STORAGE_PROVIDER=minio        # or "s3" for production
   STORAGE_BUCKET=videos
   MINIO_ENDPOINT=http://localhost:9000
   MINIO_ACCESS_KEY=admin
   MINIO_SECRET_KEY=password123
   ```

3. **Start local infrastructure (MinIO, MongoDB, RabbitMQ):**
   ```bash
   cd ../streaming-ingest
   docker compose up --build
   ```

## Vercel Environment Variables

When deploying this app to Vercel, keep these values in the server-side environment only:

- `EVENT_GATEWAY_URL`
- `INGEST_PERSISTENCE_BASE_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `E2E_AUTH_ENABLED`
- `E2E_ADMIN_EMAIL`
- `ADMIN_EMAILS`

For local development:

- `EVENT_GATEWAY_URL=http://localhost:8080/api/v1`
- `INGEST_PERSISTENCE_BASE_URL=http://localhost:8080/api/v1`

For production with AWS Lambda Function URL:

- `EVENT_GATEWAY_URL=https://<function-id>.lambda-url.<region>.on.aws`
- `INGEST_PERSISTENCE_BASE_URL=https://<function-id>.lambda-url.<region>.on.aws`

If the Lambda Function URL uses `AWS_IAM`, the current Event Gateway connector must be extended to sign requests with SigV4. As-is, the connector performs a normal `fetch`, so `NONE` is the compatible auth type today.

### Development

```bash
# Start development server on http://localhost:3000
npm run dev

# Run tests
npm test

# Run ESLint
npm run lint

# Type-check TypeScript
npx tsc --noEmit

# Build for production
npm run build

# Start production server
npm start
```

## Architecture

### Project Structure

```
src/
├── app/                 # NextJS App Router
│   └── api/            # API routes for upload endpoints
├── components/         # React components
├── lib/
│   ├── storage/        # Storage adapter interfaces & implementations
│   ├── services/       # Business logic (UploadService, VideoService)
│   └── integration/    # External service connectors
├── styles/             # Global and module styles
└── types/              # TypeScript type definitions
__tests__/              # Test files
docs/                   # Feature documentation
```

### Key Services

**UploadService** (`src/lib/services/UploadService.ts`)
- Orchestrates three-phase multipart upload flow: initiate → upload chunks → complete
- Handles chunking (10MB default) and file validation
- Emits domain events for upload lifecycle

**Storage Adapters** (`src/lib/storage/`)
- `IStorageAdapter` interface for pluggable storage providers
- `S3Adapter` for AWS S3 (production)
- `MinIOAdapter` for MinIO (local development)

## Pre-Commit Setup

This repository uses a pre-commit validation pipeline to ensure code quality before commits.

### Installation

1. **Enable the pre-commit hook:**
   ```bash
   ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
   chmod +x scripts/pre-commit.sh
   ```

2. **Verify it works:**
   ```bash
   # Make a small change (e.g., add a newline to a file)
   git add .
   git commit -m "test"
   ```

   Expected output:
   ```
   🔍 Running pre-commit checks...
   🧪 Running unit tests...
   ✅ Unit tests passed
   🔍 Running ESLint...
   ✅ ESLint passed (0 issues)
   ✔️  Running TypeScript type-checking...
   ✅ TypeScript check passed
   ✅ All pre-commit checks passed!
   ```

### What Gets Checked

- **Jest unit tests** (`npm test -- --forceExit`) — Fast unit tests only, integration tests run in CI
- **ESLint linting** (`npm run lint`) — Code style and common mistakes
- **TypeScript type-checking** (`tsc --noEmit`) — Type correctness
- **Pre-commit framework hooks** (trailing whitespace, file EOF, YAML validation, secret detection)

### Framework Hooks

The `.pre-commit-config.yaml` file manages additional framework-level checks:

- **Trailing Whitespace** — Removes trailing spaces
- **File EOF Fixer** — Ensures files end with newline
- **YAML Validation** — Validates YAML files
- **Large File Detection** — Prevents accidental large file commits (>10MB)
- **Secret Detection** (gitleaks) — Detects hardcoded API keys and credentials

### Skipping Pre-Commit Checks

If you need to bypass pre-commit checks (emergency hotfixes only):

```bash
git commit --no-verify -m "message"
```

**⚠️ Warning:** This should only be used in exceptional circumstances. Pre-commit checks exist to maintain code quality.

### Running Checks Manually

```bash
# Run pre-commit hooks on all files
pre-commit run --all-files

# Run our custom script directly
bash scripts/pre-commit.sh

# Run individual checks
npm test
npm run lint
npx tsc --noEmit
```

### Troubleshooting

**"pre-commit hook not running":**
- Ensure symlink is correct: `ls -la .git/hooks/pre-commit`
- Verify script is executable: `chmod +x scripts/pre-commit.sh`
- Check that the symlink points to the correct location

**"npm test fails on commit but passes when run manually":**
- Pre-commit runs in the project root. Verify `npm test` works from there.
- Check if you have uncommitted changes in `src/` — git hooks only check staged files.
- Try running `npm test -- --forceExit` manually to match the hook behavior

**"TypeScript check fails on commit but passes in IDE":**
- Ensure you're using the same TypeScript version: `npx tsc --version`
- Pre-commit uses `tsc --noEmit` (no-emit mode), which is stricter
- Clear the IDE cache if you're using VSCode: `Ctrl+Shift+P > TypeScript: Restart TS Server`

**"ESLint reports errors that don't seem right":**
- Make sure all dependencies are installed: `npm install`
- Clear the ESLint cache: `npm run lint -- --fix`
- Verify your `src/` files are properly formatted

## Testing

Run the full test suite:
```bash
npm test
```

Run tests for a specific file:
```bash
npx jest --testPathPattern="UploadService"
```

Run tests in watch mode:
```bash
npx jest --watch
```

Run tests with coverage:
```bash
npx jest --coverage
```

## Environment Variables

| Variable | Default | Scope | Description |
|----------|---------|-------|-------------|
| `STORAGE_PROVIDER` | `minio` | Server | Storage backend: `s3` or `minio` |
| `STORAGE_BUCKET` | `videos` | Server | Bucket/folder name for uploads |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | `3600` | Server | Signed URL lifetime in seconds |
| `STORAGE_ENCRYPTION_ENABLED` | `true` | Server | Enables storage encryption policy |
| `STORAGE_ENCRYPTION_MODE` | `AES256` | Server | Storage encryption mode |
| `STORAGE_CHECKSUM_ALGORITHM` | `SHA256` | Server | Storage checksum algorithm |
| `UPLOAD_CHUNK_SIZE_BYTES` | `104857600` | Server | Chunk size used during multipart uploads |
| `MINIO_ENDPOINT` | `http://localhost:9000` | Server | MinIO server endpoint |
| `MINIO_ACCESS_KEY` | `admin` | Server | MinIO access key |
| `MINIO_SECRET_KEY` | `password123` | Server | MinIO secret key |
| `AWS_REGION` | `us-east-1` | Server | AWS region for S3 and related services |
| `AWS_ACCESS_KEY_ID` | - | Server | AWS access key for S3 uploads |
| `AWS_SECRET_ACCESS_KEY` | - | Server | AWS secret access key for S3 uploads |
| `S3_ENDPOINT` | - | Server | Custom S3 endpoint, if used |
| `S3_FORCE_PATH_STYLE` | `false` | Server | Forces path-style S3 requests |
| `EVENT_GATEWAY_URL` | `http://localhost:8080/api/v1` | Server | Event gateway endpoint, or Lambda Function URL in production |
| `INGEST_PERSISTENCE_BASE_URL` | `http://localhost:8080/api/v1` | Server | HTTP base URL used by the upload app to persist sessions and video metadata in `streaming-ingest` |
| `NODE_ENV` | `development` | Server | Environment: `development`, `production` |
| `PORT` | `3000` | Server | App port |
| `NEXTAUTH_SECRET` | `development-secret` | Server | NextAuth JWT secret |
| `GOOGLE_CLIENT_ID` | `missing-google-client-id` | Server | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | `missing-google-client-secret` | Server | Google OAuth client secret |
| `ADMIN_EMAILS` | `admin@example.com,owner@example.com` | Server | Comma-separated admin emails |
| `E2E_AUTH_ENABLED` | `0` | Server | Enables E2E credentials login |
| `E2E_ADMIN_EMAIL` | - | Server | E2E admin email |
| `NEXT_PUBLIC_STORAGE_DIRECT_UPLOAD_ENABLED` | `false` | Client | Enables direct upload in the browser |
| `NEXT_PUBLIC_E2E_AUTH_ENABLED` | `0` | Client | Enables E2E auth UI in the browser |
| `NEXT_PUBLIC_E2E_ADMIN_EMAIL` | - | Client | E2E admin email exposed to browser for tests |

## Documentation

- `SPEC.md` — Complete API specification and architecture details
- `DOCKER.md` — Docker build and deployment instructions
- `CHANGELOG.md` — Release notes and version history
- `docs/` — Feature-specific documentation

## Related Services

This service is part of the **Video on Demand (VOD) platform** microservices:

- **streaming-ingest** — Event gateway and webhook router
- **streaming-transcode** — FFmpeg transcoding worker
- **streaming-distribution** — CDN manifest server
- **streaming-web-client** — Consumer web frontend
- **streaming-app-client** — Consumer mobile app

Refer to the parent `editor.md` for the complete architecture and end-to-end flow.

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Michelalmeidasilva_streaming-platform-upload&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Michelalmeidasilva_streaming-platform-upload)

## License

See LICENSE file (if present) or contact the project maintainers.
# Test Release
