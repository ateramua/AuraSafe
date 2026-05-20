const nextConfig = {
  output: 'export',
  // Electron dev loads the app from 127.0.0.1 while Next binds to localhost
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  trailingSlash: true,
  assetPrefix: '',
  basePath: '',
  images: { unoptimized: true },

  reactStrictMode: false,
  swcMinify: true,
  productionBrowserSourceMaps: false,

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;