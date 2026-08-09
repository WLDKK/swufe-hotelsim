/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const localHyperdriveVariable =
  "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE";

if (!process.env[localHyperdriveVariable] && process.env.DATABASE_URL) {
  process.env[localHyperdriveVariable] = process.env.DATABASE_URL;
}

initOpenNextCloudflareForDev();
