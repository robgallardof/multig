/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["better-sqlite3"],
};

module.exports = nextConfig;
