// next.config.mjs
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  // Static export for desktop build, normal behavior in dev
  output: isDev ? undefined : 'export',

  // Routing behavior
  trailingSlash: true, // ensures /vault -> /vault/index.html

  // Paths (safe defaults for both environments)
  assetPrefix: '',
  basePath: '',

  // Images (required for static export)
  images: { unoptimized: true },

  // Performance / build behavior
  reactStrictMode: false,
  swcMinify: true,
  productionBrowserSourceMaps: false,

  compiler: {
    removeConsole: !isDev, // keep logs in dev, remove in production
    styledComponents: true,
  },
};

export default nextConfig;