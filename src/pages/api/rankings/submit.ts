import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';

// 환경 변수에서 설정값 가져오기
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// JWT 페이로드 타입 (기존 인증 로직과 동일하게 정의)
interface JWTPayload {
  id: string;      // 유저의 고유 ID (예: 구글 ID)
  nickname: string;
  picture: string;
}

// 요청 헤더에서 토큰을 검증하는 함수
function authenticateToken(req: NextApiRequest): JWTPayload | null {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (err) {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // POST 요청만 처리
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 1. 사용자 인증
  const user = authenticateToken(req);
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // 2. 요청 본문에서 데이터 추출 및 검증
  const { score, mode } = req.body;
  if (typeof score !== 'number' || !['normal', 'multiplayer'].includes(mode)) {
    return res.status(400).json({ message: 'Invalid score or mode provided' });
  }

  // 3. 데이터베이스에 연결 및 점수 저장
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('yacht_game');
    
    // 게임 모드에 따라 컬렉션 이름 결정
    const collectionName = mode === 'normal' ? 'rankings_normal' : 'rankings_multi';
    const rankingsCollection = db.collection(collectionName);

    // 사용자의 기존 랭킹 정보가 있으면 업데이트, 없으면 새로 생성 (upsert)
    // 새 점수가 기존 최고 점수보다 높을 경우에만 업데이트
    await rankingsCollection.updateOne(
      { userId: user.id },
      {
        $max: { score: score }, // 기존 점수보다 새 점수가 높을 때만 score 필드를 업데이트
        $setOnInsert: {         // 문서가 새로 생성될 때만 아래 필드들을 설정
          userId: user.id,
          nickname: user.nickname,
          picture: user.picture,
          createdAt: new Date(),
        }
      },
      { upsert: true } // 해당 userId의 문서가 없으면 새로 생성
    );

    await client.close();
    res.status(200).json({ message: 'Score submitted successfully' });

  } catch (error) {
    console.error('Failed to submit score:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}