/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Cron jobs configuration
  },
  async headers() {
    return [
      {
        source: "/api/cron/refresh-data",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  }
}

module.exports = nextConfig
