import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The DLMM SDK's ESM build directory-imports @coral-xyz/anchor subpaths,
  // which Node's native ESM loader rejects. Let the bundler transpile the SDK
  // (and anchor) instead of treating them as external node modules.
  transpilePackages: ["@meteora-ag/dlmm", "@coral-xyz/anchor"],
};

export default nextConfig;
