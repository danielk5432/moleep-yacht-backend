import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';
import { waitingPlayers, getPlayerMatch } from '../../match-state';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

interface Player {
  id: string;
  nickname: string;
  joinedAt: Date;
}

interface MatchData {
  roomId: string;
  players: Player[];
  opponent: Player;
  myTurn: boolean;
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playerId } = req.query;

    if (!playerId || typeof playerId !== 'string') {
      return res.status(400).json({ error: 'Player ID is required' });
    }

    // 대기 중인지 확인
    const waitingIndex = waitingPlayers.findIndex(p => p.id === playerId);
    if (waitingIndex !== -1) {
      return res.status(200).json({
        status: 'waiting',
        message: '매칭 중입니다...'
      });
    }

    // 매칭된 게임이 있는지 확인
    const matchData = getPlayerMatch(playerId);
    if (matchData) {
      return res.status(200).json({
        status: 'matched',
        data: matchData
      });
    }

    // MongoDB에서도 확인
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('yacht_game');
    const matchesCollection = db.collection('matches');
    
    const match = await matchesCollection.findOne({
      'players.id': playerId,
      status: 'active'
    });
    
    await client.close();

    if (match) {
      const player = match.players.find((p: any) => p.id === playerId);
      const myTurn = match.players[0].id === playerId;
      
      return res.status(200).json({
        status: 'matched',
        data: {
          roomId: match.roomId,
          players: match.players,
          opponent: myTurn ? match.players[1] : match.players[0],
          myTurn
        }
      });
    }

    // 매칭되지 않음
    return res.status(200).json({
      status: 'not_found',
      message: '매칭 정보를 찾을 수 없습니다.'
    });

  } catch (error) {
    console.error('Match status check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 