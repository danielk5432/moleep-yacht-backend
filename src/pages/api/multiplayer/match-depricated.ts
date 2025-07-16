import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../lib/mongodb';
import { MongoClient } from 'mongodb';
import { Player, MatchData, good_data, bad_data, common_data, addToQueue, getPlayerMatch, removeMatchedPlayer } from './match-state';

const FRONTEND_URI = process.env.FRONTEND_URI || 'http://localhost:3000'
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

const validateDiceRecord = (record: Record<string, number>): boolean => {
  const values = Object.values(record);

  // 1. 모든 숫자의 합이 4인지 확인
  const isSumCorrect = values.reduce((sum, count) => sum + count, 0) === 4;

  // 2. 모든 숫자가 0에서 4 사이인지 확인
  const areValuesInRange = values.every(count => count >= 0 && count <= 4);

  // 두 조건을 모두 만족해야 true를 반환
  return isSumCorrect && areValuesInRange;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_URI);
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
    const { playerId, nickname, goodDiceRecord } = req.body;
    if (!playerId || !nickname || !goodDiceRecord || validateDiceRecord(goodDiceRecord) === false) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const player: Player = {
      id: playerId,
      nickname,
      joinedAt: new Date(),
      goodDiceRecord: goodDiceRecord
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
      const client = await clientPromise;
  
      // 2. client.connect()는 lib/mongodb.ts가 이미 처리하므로 필요 없습니다.
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
      
      // 3. client.close()를 호출하면 안 됩니다. 연결을 계속 재사용해야 합니다.
  
      console.log('🎯 Match found for player:', playerId, 'Opponent:', matchData.players);

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