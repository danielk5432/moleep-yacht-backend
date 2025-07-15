import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';
const allowedOrigin = isDev ? 'http://localhost:3000' : 'https://yyacht.camp';

const nextConfig: NextConfig = {
  serverExternalPackages: ['mongodb'],
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: allowedOrigin }, // 동적으로 설정된 값 사용
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;