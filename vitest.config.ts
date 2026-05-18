import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./apps/web/test/setup.ts"],
    include: ["apps/web/**/*.{test,spec}.{ts,tsx}", "packages/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: [
        "apps/web/features/dashboard/page-header.tsx",
        "apps/web/lib/ai/response-validation.ts",
        "apps/web/lib/memory/token-counter.ts",
        "apps/web/lib/performance/cache.ts",
        "apps/web/lib/rag/services/context-builder.ts",
        "apps/web/lib/security/prompt-injection-service.ts",
      ],
      exclude: [
        "**/*.config.*",
        "**/*.d.ts",
        "**/node_modules/**",
        "**/.next/**",
        "**/test/**",
        "**/__tests__/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web"),
      "@rag/ui": path.resolve(__dirname, "packages/ui/src/index.ts"),
      "@rag/types": path.resolve(__dirname, "packages/types/src/index.ts"),
    },
  },
});
