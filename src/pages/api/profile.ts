import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 토큰 검증 함수
function authenticateToken(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return { error: 'Access token required', status: 401 };
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    return { user };
  } catch (err) {
    return { error: 'Invalid token', status: 403 };
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
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

  const user = authResult.user as any;
  
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture
  });
} 