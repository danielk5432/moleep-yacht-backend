// src/socketServer.ts

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { 
    addToQueue, 
    tryMatchMaking,
    getMatchByRoomId,
    GOOD_DICE_DATA,
} from './match-state.js'; // 상태 관리 로직 import

interface Player {
    id: string;
    nickname: string;
    joinedAt: Date;
    goodDiceRecord: Record<string, number>; // 주사위 기록
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" } // 모든 출처 허용
});

// --- 전역 맵: 플레이어 ID와 소켓 ID를 매핑 ---
const playerSocketMap = new Map<string, string>();

const validateDiceRecord = (record: Record<string, number>): boolean => {
  if (!record || typeof record !== 'object') return false;
  const values = Object.values(record);
  const isSumCorrect = values.reduce((sum, count) => sum + count, 0) === 4;
  const areValuesInRange = values.every(count => count >= 0 && count <= 4);
  return isSumCorrect && areValuesInRange;
};

// --- 소켓 서버 로직 ---
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // 1. 플레이어 등록
  socket.on('register', (playerId: string) => {
    playerSocketMap.set(playerId, socket.id);
    console.log(`Player ${playerId} registered with socket ${socket.id}`);
  });

  // 2. 매칭 요청 처리
  socket.on('matchmaking:joinQueue', (playerData) => {
    const { playerId, nickname, goodDiceRecord } = playerData;

    if (!playerId || !nickname || !goodDiceRecord || !validateDiceRecord(goodDiceRecord)) {
      socket.emit('error', { message: 'Invalid request data.' });
      return;
    }

    const player: Player = { id: playerId, nickname, joinedAt: new Date(), goodDiceRecord };
    
    addToQueue(player);
    const matchData = tryMatchMaking();

    if (matchData) {
      console.log(`Match found: ${matchData.roomId}. Notifying players.`);
      
      matchData.players.forEach(p => {
        const playerSocketId = playerSocketMap.get(p.id);
        if (playerSocketId) {
          const playerSocket = io.sockets.sockets.get(playerSocketId);
          playerSocket?.join(matchData.roomId);
        }
      });
      io.to(matchData.roomId).emit('matchmaking:matched', matchData);
    } else {
      socket.emit('matchmaking:waiting');
    }
  });

  // --- 게임 진행 관련 이벤트 핸들러 ---
  // src/socketServer.ts 파일의 io.on("connection", ...) 블록 안에 추가하세요.

  socket.on('roulette:getDice', (roomId: string, callback: (response: { error?: string; selectedPool?: string[] }) => void) => {
    // 1. 현재 방의 매치 데이터를 가져옵니다.
    const matchData = getMatchByRoomId(roomId);

    // 2. 유효성 검사: 매치 데이터가 없거나 주사위가 6개 미만이면 에러를 반환합니다.
    if (!matchData) {
      return callback({ error: 'Match not found.' });
    }
    if (matchData.dicePool.length < 6) {
      return callback({ error: 'Not enough dice in the pool.' });
    }

    // 3. 주사위 풀을 무작위로 섞습니다. (원본 배열을 바꾸지 않기 위해 복사본 사용)
    const shuffledPool = [...matchData.dicePool];
    for (let i = shuffledPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
    }

    // 4. 섞인 풀에서 6개를 뽑아 'selectedPool'로 만듭니다.
    const selectedPool = shuffledPool.slice(0, 6);
    
    // 5. 서버의 'dicePool'에서는 뽑힌 6개를 제거합니다.
    matchData.dicePool = shuffledPool.slice(6);
    
    console.log(`Room ${roomId}: Dealt 6 dice. ${matchData.dicePool.length} dice remaining.`);

    // 6. 뽑힌 6개의 주사위를 클라이언트에게 콜백 함수로 되돌려줍니다.
    callback({ selectedPool });
  });
  socket.on('roulette:selectDice', (data) => { /* ... */ });
  socket.on('score:update', (data) => { /* ... */ });
  socket.on('leaveQueue', () => { /* ... */ });

  // 3. 연결 종료 처리
  socket.on("disconnect", () => {
    playerSocketMap.forEach((socketId, playerId) => {
      if (socketId === socket.id) {
        playerSocketMap.delete(playerId);
        console.log(`Player ${playerId} unregistered.`);
      }
    });
    console.log("Socket disconnected:", socket.id);
  });
});

const PORT = 3001; // 소켓 서버는 3001번 포트 사용
httpServer.listen(PORT, () => {
  console.log(`✅ Socket.IO server running on port ${PORT}`);
});