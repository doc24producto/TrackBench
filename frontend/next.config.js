/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazon.com' },
      { protocol: 'https', hostname: '**.mlstatic.com' },
      { protocol: 'https', hostname: '**.shopify.com' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' },
    ],
  },
};

module.exports = nextConfig;
