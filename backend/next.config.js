/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable serverless functions for Python integration
  experimental: {
    serverActions: true,
  },
}

module.exports = nextConfig
