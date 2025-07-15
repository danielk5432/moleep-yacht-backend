// OAuth 환경별 설정
const isDevelopment = process.env.NODE_ENV === 'development';

export const oauthConfig = {
  // 개발 환경
  development: {
    redirectUri: 'http://:8443/api/auth/google/callback',
    frontendUrl: 'http://localhost:3000',
    successUrl: 'http://localhost:3000/auth/success',
    errorUrl: 'http://localhost:3000/auth/error'
  },
  
  // 프로덕션 환경
  production: {
    redirectUri: 'https://yyacht.camp/api/auth/google/callback',
    frontendUrl: 'https://yyacht.camp',
    successUrl: 'https://yyacht.camp/auth/success',
    errorUrl: 'https://yyacht.camp/auth/error'
  }
};

export const currentConfig = isDevelopment 
  ? oauthConfig.development 
  : oauthConfig.production; 