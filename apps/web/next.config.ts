import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@rag/ui", "@rag/types"],
};

export default nextConfig;
