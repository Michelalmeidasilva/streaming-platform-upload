FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

    COPY package.json package-lock.json* ./
    RUN npm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure the public directory exists even if it's empty in the source
RUN mkdir -p public

# Set dummy environment variables for build time to avoid "Invalid endPoint" errors
# during Next.js static analysis/build.
ENV S3_ENDPOINT=localhost
ENV S3_PORT=9000
ENV S3_USE_SSL=false
ENV S3_ACCESS_KEY=minioadmin
ENV S3_SECRET_KEY=minioadmin
ENV S3_BUCKET_NAME=uploads

# NEXT_PUBLIC_* vars are inlined at build time — pass via --build-arg
ARG NEXT_PUBLIC_E2E_AUTH_ENABLED=0
ARG NEXT_PUBLIC_E2E_ADMIN_EMAIL=
ARG NEXT_PUBLIC_STORAGE_DIRECT_UPLOAD_ENABLED=false
ENV NEXT_PUBLIC_E2E_AUTH_ENABLED=$NEXT_PUBLIC_E2E_AUTH_ENABLED
ENV NEXT_PUBLIC_E2E_ADMIN_EMAIL=$NEXT_PUBLIC_E2E_ADMIN_EMAIL
ENV NEXT_PUBLIC_STORAGE_DIRECT_UPLOAD_ENABLED=$NEXT_PUBLIC_STORAGE_DIRECT_UPLOAD_ENABLED

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# The next/image optimizer writes optimized images to .next/cache/images at
# runtime. Create it and hand ownership to the unprivileged runtime user so the
# mkdir does not fail with EACCES (which degrades/duplicates optimizer work).
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
