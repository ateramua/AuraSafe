const nextConfig = {
  output: 'export',
  trailingSlash: true,
  assetPrefix: '',
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