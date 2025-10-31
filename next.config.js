/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    KOMMO_SUBDOMAIN: process.env.NEXT_PUBLIC_KOMMO_SUBDOMAIN,
    KOMMO_API_KEY: process.env.NEXT_PUBLIC_KOMMO_ACCESS_TOKEN,
    NEXT_PUBLIC_OPENAI_API_KEY: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  },
  // Exclude client folder from build
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/client/**', '**/node_modules/**'],
    }
    return config
  },
}

module.exports = nextConfig

