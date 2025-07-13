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

  if (req.method !== 'DELETE') {
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

  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db('yacht_game');
    const usersCollection = db.collection('users');
    
    // 사용자 계정 삭제
    const result = await usersCollection.deleteOne({ googleId: authResult.user.id });
    
    await client.close();

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 