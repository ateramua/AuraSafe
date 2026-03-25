// next.config.mjs
const nextConfig = {
  output: 'export',           // static export
  trailingSlash: true,        // /vault → /vault/index.html
  assetPrefix: './',          // ensures JS/CSS/images load relative to app://
  basePath: '',               // no subpath
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