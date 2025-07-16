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
import path from "path";

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

  socket.on('roulette:getDice', (
    roomId: string, 
    playerId: string, // 누가 요청했는지 식별하기 위한 인자 추가
    callback: (response: { error?: string; selectedPool?: string[] }) => void
  ) => {
    // 1. 매치 정보 가져오기
    const matchData = getMatchByRoomId(roomId);
    if (!matchData) {
      return callback({ error: 'Match not found.' });
    }

    // 2. 요청한 플레이어의 인덱스 찾기
    const playerIndex = matchData.players.findIndex((p : Player) => p.id === playerId);
    if (playerIndex === -1) {
      return callback({ error: 'Player not found in this match.' });
    }

    // 3. 이미 주사위를 받았는지 확인 (중복 지급 방지)
    if (matchData.roulettePool[playerIndex].length > 0) {
      return callback({ 
        error: 'You have already received your dice.',
        selectedPool: matchData.roulettePool[playerIndex] // 이미 받은 주사위를 다시 보내줌
      });
    }

    // 4. 주사위 풀에 주사위가 충분한지 확인
    if (matchData.dicePool.length < 6) {
      return callback({ error: 'Not enough dice in the pool.' });
    }

    // 5. 주사위 풀에서 6개 주사위를 제거하며 가져오기 (splice 사용)
    const selectedPool = matchData.dicePool.splice(0, 6);
    
    // 6. 가져온 주사위를 해당 플레이어의 roulettePool 인덱스에 저장
    matchData.roulettePool[playerIndex] = selectedPool;
    
    console.log(`🎲 Room ${roomId}: Player ${playerId} (index: ${playerIndex}) received 6 dice.`);
    console.log(`   ㄴ Remaining dice in main pool: ${matchData.dicePool.length}`);
    console.log(`   ㄴ Current roulettePool state:`, matchData.roulettePool);

    updateGoodDiceCount(io, matchData.roomId);
    // 7. 클라이언트에게 선택된 주사위 전달
    if (typeof callback === 'function') {
    callback({ selectedPool });
    } else {
      console.log(`[Warning] Client did not provide a callback for 'roulette:getDice' from room ${roomId}`);
    }
  });

  // 2. ✅ 룰렛 결과 처리 로직 (수정된 부분)
  // socket.on 핸들러 부분

  socket.on('roulette:selectDice', (data: { 
    roomId: string, 
    playerId: string, // 누가 선택했는지 식별
    selectedDie: string // 선택한 주사위 1개만 받음
  }) => {
    const { roomId, playerId, selectedDie } = data;

    // 1. 매치 정보 및 플레이어 인덱스 가져오기
    const matchData = getMatchByRoomId(roomId);
    if (!matchData) return;

    const playerIndex = matchData.players.findIndex((p: Player) => p.id === playerId);
    if (playerIndex === -1) return;

    // 2. 서버에 저장된 플레이어의 룰렛 주사위 풀 가져오기
    const playerRoulettePool = matchData.roulettePool[playerIndex];
    if (!playerRoulettePool || playerRoulettePool.length === 0) {
      console.log(`[Warning] Room ${roomId}: Player ${playerId} tried to select a die without a pool.`);
      return;
    }
    
    // 3. 플레이어가 유효한 주사위를 선택했는지 확인 (선택적)
    if (!playerRoulettePool.includes(selectedDie)) {
      console.log(`[Warning] Room ${roomId}: Player ${playerId} tried to select a die they don't have: '${selectedDie}'`);
      return;
    }

    console.log(`Room ${roomId}: Player ${playerId} selected '${selectedDie}'.`);

    // 4. 선택되지 않은 나머지 5개 주사위를 찾아 메인 풀에 복원
    const unselectedDice = playerRoulettePool.filter((d: string) => d !== selectedDie);
    matchData.dicePool.push(...unselectedDice);
    console.log(`   - Restored 5 unselected dice to the main pool.`);

    // 5. 선택된 주사위 처리 (좋은 주사위 vs 아닌 것)
    const isGoodDice = GOOD_DICE_DATA.includes(selectedDie);
    if (isGoodDice) {
      // 좋은 주사위는 소모됨 (복원하지 않음)
      console.log(`   - '${selectedDie}' is a good die and was consumed.`);
      matchData.goodDiceCounts[selectedDie] -= 1;
      updateGoodDiceCount(io, roomId); // 좋은 주사위 개수 변경 알림
    } else {
      // 좋은 주사위가 아니면 다시 주사위 풀에 복원
      matchData.dicePool.push(selectedDie);
      console.log(`   - '${selectedDie}' is not a good die and was restored.`);
    }

    // 6. 플레이어의 룰렛 풀 비우기 (선택 완료)
    matchData.roulettePool[playerIndex] = [];
    
    console.log(`   - Dice pool now has ${matchData.dicePool.length} dice.`);
  }); 

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

function updateGoodDiceCount(io: Server, roomId: string) {
    const matchData = getMatchByRoomId(roomId);
    if (!matchData) return;
    console.log(`Broadcasting good dice counts for room ${roomId}:`, matchData.goodDiceCounts);
    io.to(roomId).emit('game:goodDiceUpdate', matchData.goodDiceCounts);
}