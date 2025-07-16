import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('yacht_game');
    const collection = db.collection('rankings_normal');

    // 점수가 높은 순으로 상위 100명을 조회합니다.
    const topScores = await collection
      .find({})
      .sort({ score: -1 }) // 점수 내림차순
      .limit(100)          // 상위 100명
      .toArray();

    // 조회된 결과에 순위(rank) 정보를 추가합니다.
    const rankedData = topScores.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
    
    await client.close();
    res.status(200).json(rankedData);

  } catch (error) {
    console.error('Failed to fetch normal rankings:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}