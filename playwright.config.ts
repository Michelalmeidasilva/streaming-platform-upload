import { defineConfig, devices } from '@playwright/test';

const e2ePort = 3100;
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: e2eBaseUrl,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshots for all actions */
    screenshot: 'on',

    /* Record video for each execution */
    video: 'on',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${e2ePort}`,
    env: {
      ADMIN_EMAILS: 'admin-e2e@example.com',
      E2E_AUTH_ENABLED: '1',
      NEXTAUTH_SECRET: 'playwright-e2e-secret',
      NEXT_PUBLIC_E2E_ADMIN_EMAIL: 'admin-e2e@example.com',
      NEXT_PUBLIC_E2E_AUTH_ENABLED: '1',
      STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'minio',
      STORAGE_BUCKET: process.env.STORAGE_BUCKET || 'videos',
      NEXT_PUBLIC_STORAGE_DIRECT_UPLOAD_ENABLED: process.env.NEXT_PUBLIC_STORAGE_DIRECT_UPLOAD_ENABLED || 'false',
      STORAGE_ENCRYPTION_ENABLED: process.env.STORAGE_ENCRYPTION_ENABLED || 'false',
      MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'admin',
      MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'password123',
      STORAGE_ENCRYPTION_MODE: process.env.STORAGE_ENCRYPTION_MODE || 'AES256',
      STORAGE_CHECKSUM_ALGORITHM: process.env.STORAGE_CHECKSUM_ALGORITHM || 'SHA256',
      UPLOAD_CHUNK_SIZE_BYTES: process.env.UPLOAD_CHUNK_SIZE_BYTES || '104857600',
    },
    url: e2eBaseUrl,
    reuseExistingServer: false,
  },
});
