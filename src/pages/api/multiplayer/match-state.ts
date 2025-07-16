// match-state.ts

export interface Player {
  id: string;
  nickname: string;
  joinedAt: Date;
  goodDiceRecord: Record<string, number>;
}

export interface MatchData {
  roomId: string;
  players: Player[];
  dicePool: string[];
  selectedPool: string[];
  createdAt: Date;
}

export const GOOD_DICE_DATA = ['456Dice', 'OneMoreDice', 'HighDice', 'WildDice'];
export const BAD_DICE_DATA = ['123Dice', 'OneMinusDice', 'RiskDice'];
export const COMMON_DICE_DATA = ['1or6Dice', 'ConstantDice', 'OddDice', 'EvenDice'];

// --- 전역 상태 ---
const waitingPlayers: Player[] = [];
const activeMatches = new Map<string, MatchData>();

// --- 상태 관리 함수 ---

export const addToQueue = (player: Player) => {
  if (waitingPlayers.some(p => p.id === player.id)) return;
  waitingPlayers.push(player);
  console.log('📋 Player added to queue:', player.nickname, 'Queue length:', waitingPlayers.length);
};

export const tryMatchMaking = (): MatchData | null => {
  if (waitingPlayers.length < 4) return null;

  const matchedPlayers = waitingPlayers.splice(0, 4);
  const roomId = `room_${Date.now()}`;
  const initialDicePool = createDicePool(matchedPlayers);

  const newMatch: MatchData = { roomId, players: matchedPlayers, dicePool: initialDicePool, selectedPool: [], createdAt: new Date() };
  activeMatches.set(roomId, newMatch);

  console.log(`🎯 Match found! Room: ${roomId}`);
  return newMatch;
};

// ✅ 정의 추가: roomId로 활성화된 매치 정보를 가져오는 함수
export const getMatchByRoomId = (roomId: string): MatchData | undefined => {
  return activeMatches.get(roomId);
};

// --- 내부 헬퍼 함수 ---

function createDicePool(players: Player[]): string[] {
  let pool: string[] = [];

  // 좋은 주사위 추가
  players.forEach(player => {
    const playerGoodDice = Object.entries(player.goodDiceRecord)
      .flatMap(([key, value]) => Array(value).fill(key));
    pool.push(...playerGoodDice);
  });

  // 공통 및 나쁜 주사위 추가
  for (let i = 0; i < players.length * 4; i++) {
    pool.push(COMMON_DICE_DATA[Math.floor(Math.random() * COMMON_DICE_DATA.length)]);
  }
  for (let i = 0; i < players.length * 2; i++) {
    pool.push(BAD_DICE_DATA[Math.floor(Math.random() * BAD_DICE_DATA.length)]);
  }

  // 주사위 풀 셔플
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}