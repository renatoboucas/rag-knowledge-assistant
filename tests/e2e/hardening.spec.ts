import { expect, test } from "@playwright/test";

test("security headers are present on public pages", async ({ request }) => {
  const response = await request.get("/");

  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
});

test("landing page exposes accessible landmarks and primary actions", async ({ request }) => {
  const response = await request.get("/");
  const html = await response.text();

  expect(response.ok()).toBe(true);
  expect(html).toContain("<main");
  expect(html).toContain('aria-label="Primary navigation"');
  expect(html).toContain("<h1");
  expect(html).toContain("RAG Knowledge Assistant");
  expect(html).toContain("Open workspace");
});

test("public API rejects unauthenticated requests without server errors", async ({ request }) => {
  const response = await request.get("/api/public/v1/documents");

  expect(response.status()).toBe(401);
  await expect(response).not.toBeOK();
  expect(await response.json()).toEqual({ error: "missing_api_key" });
});

test("landing page meets launch smoke performance budget", async ({ request }) => {
  const started = performance.now();
  const response = await request.get("/");
  await response.text();
  const duration = performance.now() - started;

  expect(response.ok()).toBe(true);
  expect(duration).toBeLessThan(8_000);
});
