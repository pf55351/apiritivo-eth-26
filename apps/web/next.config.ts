import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Monorepo: trace files from the repo root so Vercel bundles the workspace packages.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Workspace packages export raw TypeScript; let Next compile them.
  transpilePackages: ["@apiritivo/shared", "@apiritivo/swarm", "@apiritivo/arkiv", "@apiritivo/payments"],
};

export default nextConfig;
