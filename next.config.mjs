/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // CSV uploads are parsed client-side, but parsed rows are posted to a
      // server action, so allow a generous body size for large statements.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
