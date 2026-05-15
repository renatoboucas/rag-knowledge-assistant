import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@rag/ui", "@rag/types"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  webpack(config) {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /node_modules\/(@opentelemetry|require-in-the-middle)/,
        message: /Critical dependency/,
      },
    ];

    return config;
  },
};

export default nextConfig;
