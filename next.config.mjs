// next.config.mjs
const isDev = process.env.NODE_ENV === 'development';
const isElectron = process.env.ELECTRON === 'true';

const nextConfig = {
  // Use output: 'export' for production builds (replaces next export)
  output: isDev ? undefined : 'export',
  
  // Basic configuration
  reactStrictMode: false,
  swcMinify: true,
  trailingSlash: true,
  
  // Image optimization (required for static export)
  images: {
    unoptimized: true,
  },
  
  // Compiler options
  compiler: {
    styledComponents: true,
    // Only remove console in production
    removeConsole: !isDev,
  },
  
  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_IS_ELECTRON: isElectron ? 'true' : 'false',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '1.0.0',
  },
  
  // Optimize development performance
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Handle native modules in Electron
    if (isElectron && !isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'keytar': 'commonjs keytar',
        'sqlite3': 'commonjs sqlite3',
        'ws': 'commonjs ws',
      });
    }
    return config;
  },
};

export default nextConfig;