/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow access from local network IPs (e.g. 192.168.x.x) without cross-origin warnings
  allowedDevOrigins: ['localhost', '192.168.29.96'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000') + '/api/:path*'
      }
    ];
  }
};

export default nextConfig;
