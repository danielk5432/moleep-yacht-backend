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
    const collection = db.collection('rankings_multi'); // 멀티플레이 컬렉션 조회

    const topScores = await collection
      .find({})
      .sort({ score: -1 })
      .limit(100)
      .toArray();

    const rankedData = topScores.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
    
    await client.close();
    res.status(200).json(rankedData);

  } catch (error) {
    console.error('Failed to fetch multiplayer rankings:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}