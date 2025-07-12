import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';

dotenv.config(); // .env 파일 사용 설정

const app: Express = express();
const port = process.env.PORT || 8443;

// Google OAuth 설정
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(MONGODB_URI);

const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'http://localhost:8443/auth/google/callback'
);

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
})); // CORS 설정
app.use(express.json()); // JSON 요청 본문 파싱

// MongoDB 연결 함수
async function connectDB() {
  try {
    await client.connect();
    console.log('MongoDB 연결 성공');
  } catch (error) {
    console.error('MongoDB 연결 실패:', error);
  }
}

// Google OAuth 로그인 URL 생성
app.get('/auth/google', (req: Request, res: Response) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    prompt: 'consent'
  });
  res.json({ authUrl });
});

// Google OAuth 콜백 처리
app.get('/auth/google/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    // 액세스 토큰 교환
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 사용자 정보 가져오기
    const userinfo = await oauth2Client.request({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo'
    });

    const userData = userinfo.data as any;
    
    // MongoDB에 사용자 정보 저장 또는 업데이트
    const db = client.db('yacht_game');
    const usersCollection = db.collection('users');
    
    await usersCollection.updateOne(
      { googleId: userData.id },
      {
        $set: {
          googleId: userData.id,
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
          lastLogin: new Date()
        }
      },
      { upsert: true }
    );
    
    // JWT 토큰 생성
    const token = jwt.sign(
      {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        picture: userData.picture
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 프론트엔드로 리다이렉트 (토큰 포함)
    res.redirect(`http://localhost:3000/auth/success?token=${token}`);
  } catch (error) {
    console.error('OAuth error:', error);
    res.redirect('http://localhost:3000/auth/error');
  }
});

// 토큰 검증 미들웨어
const authenticateToken = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    (req as any).user = user;
    next();
  });
};

// 보호된 라우트 예시
app.get('/api/profile', authenticateToken, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture
  });
});

app.get('/', (req: Request, res: Response) => {
  res.send('야추 게임 백엔드 서버');
});

// 서버 시작
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`[server]: 서버가 http://localhost:${port} 에서 실행 중입니다.`);
  });
});
