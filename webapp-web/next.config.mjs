/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during production builds — lint in CI separately
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Also ignore TS errors during build (tsc --noEmit passes cleanly separately)
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ilxojqefffravkjxyqlx.supabase.co',
      },
    ],
  },
};

export default nextConfig;

