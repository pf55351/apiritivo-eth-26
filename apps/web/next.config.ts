import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages export raw TypeScript; let Next compile them.
  transpilePackages: ["@apiperitivo/shared", "@apiperitivo/swarm", "@apiperitivo/arkiv", "@apiperitivo/payments"],
};

export default nextConfig;
