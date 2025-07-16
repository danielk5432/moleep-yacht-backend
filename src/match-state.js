// match-state.js

export const GOOD_DICE_DATA = ['456Dice', 'OneMoreDice', 'HighDice', 'WildDice'];
export const BAD_DICE_DATA = ['123Dice', 'OneMinusDice', 'RiskDice'];
export const COMMON_DICE_DATA = ['1or6Dice', 'ConstantDice', 'OddDice', 'EvenDice'];

export const CATEGORIES = [
  'Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes',
  'Choice', 'Four of a Kind', 'Full House', 'Little Straight', 'Big Straight', 'Yacht'
];


// --- 전역 상태 ---
const waitingPlayers = [];
const activeMatches = new Map();

// --- 상태 관리 함수 ---

export const addToQueue = (player) => {
  if (waitingPlayers.some(p => p.id === player.id)) return;
  waitingPlayers.push(player);
  console.log('📋 Player added to queue:', player.nickname, 'Queue length:', waitingPlayers.length);
};

export const tryMatchMaking = () => {
  if (waitingPlayers.length < 4) return null;

  const matchedPlayers = waitingPlayers.splice(0, 4).map(player => {
    // ✅ 각 플레이어의 점수판을 null로 초기화합니다.
    const initialScores = {};
    CATEGORIES.forEach(cat => {
      initialScores[cat] = null;
    });
    return { ...player, scores: initialScores };
  });
  
  const roomId = `room_${Date.now()}`;
  const initialDicePool = createDicePool(matchedPlayers);
  const initialGoodDiceCounts = {};
  GOOD_DICE_DATA.forEach(diceName => {
    initialGoodDiceCounts[diceName] = initialDicePool.filter(d => d === diceName).length;
  });
  
  const newMatch = { 
    roomId, 
    players: matchedPlayers, 
    dicePool: initialDicePool,
    goodDiceCounts: initialGoodDiceCounts,
    roulettePool: [[], [], [], []],
    createdAt: new Date() 
  };
  activeMatches.set(roomId, newMatch);

  console.log(`🎯 Match found! Room: ${roomId}`);
  return newMatch;
};

export const getMatchByRoomId = (roomId) => {
  return activeMatches.get(roomId);
};

// --- 내부 헬퍼 함수 ---

function createDicePool(players) {
  let pool = [];

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