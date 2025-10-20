import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Provide a build-time alias so runtime imports of `@walletconnect/utils` resolve
  // to our compatibility shim that re-exports the real runtime bundle and
  // exposes a `createLogger` helper for older consumers.
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@walletconnect/utils": path.resolve(__dirname, "shims/walletconnect-utils-compat.js"),
    };
    return config;
  },
};

export default nextConfig;
