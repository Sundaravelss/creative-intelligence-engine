/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@cie/ui-artifacts",
    "@cie/canvas-nodes",
    "@cie/shared-types",
    "studio",
  ],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
