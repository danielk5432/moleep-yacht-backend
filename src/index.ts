import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config(); // .env 파일 사용 설정

const app: Express = express();
const port = process.env.PORT || 8000;

app.use(cors()); // CORS 설정
app.use(express.json()); // JSON 요청 본문 파싱

app.get('/', (req: Request, res: Response) => {
  res.send('야추 게임 백엔드 서버');
});

app.listen(port, () => {
  console.log(`[server]: 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
