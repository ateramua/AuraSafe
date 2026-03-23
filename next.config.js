// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',           // static export
  trailingSlash: true,        // /vault → /vault/index.html
  assetPrefix: './',          // relative paths for JS/CSS/images
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

module.exports = nextConfig;