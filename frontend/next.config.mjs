/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "backend" },
      { protocol: "http", hostname: "192.168.1.10" },
    ],
  },
  allowedDevOrigins: ["192.168.1.10", "192.168.1.10:3000", "late-lions-throw.loca.lt"],
  // Prevent browser from caching JS chunks so stale module errors never occur
  async headers() {
    return [
      {
        // Next.js JS/CSS chunks — these have content hashes in their names
        // when built for production, but in dev we need no-store to be safe
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // HTML pages — always revalidate
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        // Static assets (icons, manifest)
        source: "/(icon.*|manifest.json|apple-touch-icon.png|sw.js)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
