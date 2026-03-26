// next.config.mjs
const nextConfig = {
  output: 'export',          // static export
  trailingSlash: true,       // ensures /vault -> /vault/index.html
  assetPrefix: '',           // use absolute paths (since we'll serve via HTTP)
  basePath: '',
  images: { unoptimized: true },

  reactStrictMode: false,
  swcMinify: true,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: true,
    styledComponents: true,
  },
};

export default nextConfig;