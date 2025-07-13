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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authResult = authenticateToken(req, res);
  
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  // user가 undefined인지 확인
  if (!authResult.user) {
    return res.status(401).json({ error: 'User not found in token' });
  }

  const { nickname } = req.body;
  
  if (!nickname || nickname.trim().length < 2) {
    return res.status(400).json({ error: 'Nickname must be at least 2 characters long' });
  }

  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db('yacht_game');
    const usersCollection = db.collection('users');
    
    // 사용자 정보 업데이트
    await usersCollection.updateOne(
      { googleId: authResult.user.id },
      {
        $set: {
          nickname: nickname.trim(),
          profileSetup: true,
          updatedAt: new Date()
        }
      }
    );

    await client.close();

    // 새로운 JWT 토큰 생성 (닉네임 포함)
    const newToken = jwt.sign(
      {
        id: authResult.user.id,
        email: authResult.user.email,
        name: authResult.user.name,
        picture: authResult.user.picture,
        nickname: nickname.trim()
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      success: true, 
      token: newToken,
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        name: authResult.user.name,
        picture: authResult.user.picture,
        nickname: nickname.trim()
      }
    });
  } catch (error) {
    console.error('Profile setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 