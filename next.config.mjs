/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [".monkeycode-ai.live"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
