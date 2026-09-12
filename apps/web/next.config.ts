import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages export raw TypeScript; let Next compile them.
  transpilePackages: ["@apiritivo/shared", "@apiritivo/swarm", "@apiritivo/arkiv", "@apiritivo/payments"],
};

export default nextConfig;
