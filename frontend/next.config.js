/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow access from local network IPs (e.g. 192.168.x.x) without cross-origin warnings
  allowedDevOrigins: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  }
};

export default nextConfig;
