import { expect, test } from "@playwright/test";

test("landing page renders the product shell", async ({ request }) => {
  const response = await request.get("/");
  const html = await response.text();

  expect(response.ok()).toBe(true);
  expect(html).toContain("RAG Knowledge Assistant");
  expect(html).toMatch(/retrieval/i);
});

test("protected dashboard requires authentication", async ({ request }) => {
  const response = await request.get("/dashboard/admin", {
    maxRedirects: 0,
  });

  expect([307, 401, 404]).toContain(response.status());
  expect(response.status()).not.toBe(500);
});
