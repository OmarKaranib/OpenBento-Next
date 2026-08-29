import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@openbento/domain",
    "@openbento/watchbot",
    "@openbento/ui",
  ],
};

export default nextConfig;
