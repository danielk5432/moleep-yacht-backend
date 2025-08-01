import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// JWT 토큰의 페이로드 타입 정의
interface JWTPayload {
  id: string;
  email: string;
  name: string;
  picture: string;
  nickname?: string;
}

// 토큰 검증 함수
function authenticateToken(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return { error: 'Access token required', status: 401 };
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return { user };
  } catch (err) {
    return { error: 'Invalid token', status: 403 };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authResult = authenticateToken(req, res);
  
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  const user = authResult.user as JWTPayload;
  
  try {
    // MongoDB에서 최신 사용자 정보 가져오기
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('yacht_game');
    const usersCollection = db.collection('users');
    
    const userData = await usersCollection.findOne({ googleId: user.id });
    await client.close();
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      nickname: userData?.nickname || null,
      profileSetup: userData?.profileSetup || false
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    // MongoDB 연결 실패 시에도 기본 사용자 정보 반환
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      nickname: null,
      profileSetup: false
    });
  }
} 