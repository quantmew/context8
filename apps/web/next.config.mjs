/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@context8/database', '@context8/embedding', '@context8/vector-store', '@context8/types'],
};

export default nextConfig;
