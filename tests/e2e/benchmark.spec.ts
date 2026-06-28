import { test, expect } from "@playwright/test";

// The dev server cold-starts and compiles on first request; allow extra time.
test.setTimeout(60_000);

test("ADMIN dispara benchmark e vê o sessionId", async ({ page }) => {
  // Intercept the launch API before any navigation so no real orchestrator is called.
  // The route returns 200 (not 202) to match the actual API handler.
  await page.route("**/api/benchmark/launch", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionId: "e2e-123" }),
    })
  );

  // ── Authentication ────────────────────────────────────────────────────────
  // The e2e-session cookie approach gives MEMBER role on the client because
  // process.env.ADMIN_EMAILS is not a NEXT_PUBLIC_ var and is unavailable in
  // the browser bundle. Instead, use NextAuth credentials sign-in so the role
  // is resolved server-side (where ADMIN_EMAILS=admin-e2e@example.com is set
  // by playwright.config.ts) and baked into the JWT session cookie.
  //
  // Flow: GET /api/auth/csrf → POST /api/auth/callback/credentials (with json=true
  // to avoid redirect) → session-token cookie is set → page.goto('/') reads ADMIN JWT.

  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json() as { csrfToken: string };

  await page.request.post("/api/auth/callback/credentials", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: new URLSearchParams({
      email: "admin-e2e@example.com",
      csrfToken,
      callbackUrl: "/",
      json: "true",
    }).toString(),
    failOnStatusCode: false,
  });

  // Navigate to home. Session cookie is now set; useSession() returns ADMIN JWT.
  await page.goto("/");

  // Wait for the Benchmark tab to appear in the sidebar — it is ADMIN-only,
  // so its presence proves authentication and role assignment worked correctly.
  // aria-label is "Benchmark" (from t('app.sidebar.benchmark') = 'Benchmark').
  // Use exact: true to avoid matching the "Benchmarks Storage" button as well.
  const benchmarkNavBtn = page
    .getByRole("button", { name: "Benchmark", exact: true })
    .first();
  await expect(benchmarkNavBtn).toBeVisible({ timeout: 30000 });

  // Navigate to the Benchmark tab.
  await benchmarkNavBtn.click();

  // Select the c5.xlarge machine.
  // The checkbox has aria-label="c5.xlarge" (BenchmarkLauncher.tsx line 52).
  await page.locator('[aria-label="c5.xlarge"]').check();

  // Click the launch button (disabled when no machine is selected; now enabled).
  await page.getByRole("button", { name: /rodar benchmark/i }).click();

  // The BenchmarkLauncher sets status to `Sessão iniciada: ${body.sessionId}`,
  // so the mocked sessionId "e2e-123" must be visible.
  await expect(page.getByText("e2e-123")).toBeVisible();
});
