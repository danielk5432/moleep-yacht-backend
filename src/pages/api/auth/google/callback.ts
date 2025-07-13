import { NextApiRequest, NextApiResponse } from 'next';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

import { currentConfig } from '../../../../config/oauth';

const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  currentConfig.redirectUri
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    // MongoDB 연결
    const client = new MongoClient(MONGODB_URI);
    await client.connect();

    // 액세스 토큰 교환
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 사용자 정보 가져오기
    const userinfo = await oauth2Client.request({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo'
    });

    const userData = userinfo.data as any;
    
    // MongoDB에 사용자 정보 저장 또는 업데이트
    const db = client.db('yacht_game');
    const usersCollection = db.collection('users');
    
    await usersCollection.updateOne(
      { googleId: userData.id },
      {
        $set: {
          googleId: userData.id,
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
          lastLogin: new Date()
        }
      },
      { upsert: true }
    );
    
    // JWT 토큰 생성
    const token = jwt.sign(
      {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        picture: userData.picture
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await client.close();

    // 프론트엔드로 리다이렉트 (토큰 포함)
    res.redirect(`${currentConfig.successUrl}?token=${token}`);
  } catch (error) {
    console.error('OAuth error:', error);
    res.redirect(currentConfig.errorUrl);
  }
} 