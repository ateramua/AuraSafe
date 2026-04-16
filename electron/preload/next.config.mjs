/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // This replaces next export
  images: {
    unoptimized: true, // Required for static export
  },
  trailingSlash: true,
  distDir: 'out',
};

export default nextConfig;
