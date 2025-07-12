# Yacht Game Backend

야추 게임 백엔드 서버입니다.

## 설치 및 실행

1. 의존성 설치:
```bash
npm install
```

2. 환경 변수 설정:
```bash
cp env.example .env
```

3. `.env` 파일을 편집하여 Google OAuth 설정을 추가:
```
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
JWT_SECRET=your_jwt_secret_key_here
PORT=8000
```

## Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트 생성
2. Google+ API 활성화
3. OAuth 2.0 클라이언트 ID 생성
4. 승인된 리디렉션 URI에 `http://localhost:3000/auth/success` 추가
5. 클라이언트 ID와 시크릿을 `.env` 파일에 설정

## 개발 서버 실행

```bash
npm run dev
```

서버는 `http://localhost:8000`에서 실행됩니다.

## API 엔드포인트

- `GET /` - 서버 상태 확인
- `GET /auth/google` - Google OAuth 로그인 URL 생성
- `GET /auth/google/callback` - OAuth 콜백 처리
- `GET /api/profile` - 사용자 프로필 (인증 필요) 
