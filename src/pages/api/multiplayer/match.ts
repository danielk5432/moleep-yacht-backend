import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';
import { addToQueue, tryMatch, getPlayerMatch, removeMatchedPlayer } from './match-state';

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playerId, nickname } = req.body;

    if (!playerId || !nickname) {
      return res.status(400).json({ error: 'Player ID and nickname are required' });
    }

    const player: Player = {
      id: playerId,
      nickname,
      joinedAt: new Date()
    };

    // 대기열에 추가 (내부에서 자동으로 매칭 시도)
    addToQueue(player);

    // 이미 매칭된 상태인지 확인
    const matchData = getPlayerMatch(playerId);
    console.log('🔍 Checking if player is already matched:', playerId, matchData ? 'YES' : 'NO');

    if (matchData) {
      // 매칭된 플레이어들을 대기열에서 제거
      matchData.players.forEach((player: any) => {
        removeMatchedPlayer(player.id);
      });

      // MongoDB에 매치 정보 저장 (한 번만 저장)
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      
      const db = client.db('yacht_game');
      const matchesCollection = db.collection('matches');
      
      // 이미 저장된 매치인지 확인
      const existingMatch = await matchesCollection.findOne({
        roomId: matchData.roomId
      });
      
      if (!existingMatch) {
        await matchesCollection.insertOne({
          roomId: matchData.roomId,
          players: matchData.players,
          createdAt: new Date(),
          status: 'active'
        });
      }
      
      await client.close();

      console.log('🎯 Match found for player:', playerId, 'Opponent:', matchData.opponent.nickname);

      return res.status(200).json({
        status: 'matched',
        data: matchData
      });
    } else {
      // 매칭 대기 상태
      return res.status(200).json({
        status: 'waiting',
        message: '매칭 중입니다...'
      });
    }
  } catch (error) {
    console.error('Match request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 