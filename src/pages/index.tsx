import { NextPage } from 'next';
import type { Metadata } from 'next';

const Home: NextPage = () => {
  return (
    <>
      <h1>
        <title>야추 게임 백엔드 - YYacht</title>
        <meta name="description" content="야추 게임 백엔드 API 서버" />
      </h1>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f5f5f5'
      }}>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>
          🎲 야추 게임 백엔드 서버
        </h1>
        <p style={{ color: '#666', fontSize: '18px' }}>
          API 서버가 정상적으로 실행 중입니다.
        </p>
        <div style={{ marginTop: '30px' }}>
          <h3>사용 가능한 API 엔드포인트:</h3>
          <ul style={{ textAlign: 'left', color: '#555' }}>
            <li><code>GET /api/auth/google</code> - Google OAuth 로그인 URL</li>
            <li><code>GET /api/auth/google/callback</code> - Google OAuth 콜백</li>
            <li><code>GET /api/profile</code> - 사용자 프로필 (인증 필요)</li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default Home; 