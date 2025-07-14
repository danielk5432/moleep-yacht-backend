import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';
import { removeFromQueue } from '../match-state';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

interface Player {
  id: string;
  nickname: string;
  joinedAt: Date;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
    }

    // 대기열에서 제거
    removeFromQueue(playerId);

    // MongoDB에서도 매치 정보 제거 (필요한 경우)
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('yacht_game');
    const matchesCollection = db.collection('matches');
    
    // 해당 플레이어가 포함된 매치를 찾아서 제거
    await matchesCollection.deleteMany({
      'players.id': playerId,
      status: 'active'
    });
    
    await client.close();

    return res.status(200).json({
      status: 'cancelled',
      message: '매칭이 취소되었습니다.'
    });

  } catch (error) {
    console.error('Cancel match error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 