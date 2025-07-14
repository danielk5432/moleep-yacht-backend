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

// 전역 상태 관리 (서버 재시작 시 초기화됨)
export const waitingPlayers: Player[] = [];
export const activeMatches = new Map<string, MatchData>();

export const addToQueue = (player: Player) => {
  // 이미 매칭된 상태인지 확인
  const existingMatch = getPlayerMatch(player.id);
  if (existingMatch) {
    console.log('⚠️ Player already matched:', player.nickname, 'Skipping queue');
    return;
  }

  // 이미 대기 중인지 확인하고 제거
  const existingIndex = waitingPlayers.findIndex(p => p.id === player.id);
  if (existingIndex !== -1) {
    waitingPlayers.splice(existingIndex, 1);
  }

  // 대기열에 추가
  waitingPlayers.push(player);
  console.log('📋 Player added to queue:', player.nickname, 'Queue length:', waitingPlayers.length);
  
  // 매칭 시도 (새로운 플레이어가 들어올 때마다)
  const matchData = tryMatch();
  if (matchData) {
    console.log('🎯 Auto-match triggered for:', player.nickname);
  }
};

export const removeFromQueue = (playerId: string) => {
  const index = waitingPlayers.findIndex(p => p.id === playerId);
  if (index !== -1) {
    const removedPlayer = waitingPlayers.splice(index, 1)[0];
    console.log('❌ Player removed from queue:', removedPlayer.nickname);
    return true;
  }
  return false;
};

export const tryMatch = () => {
  if (waitingPlayers.length >= 2) {
    const player1 = waitingPlayers.shift()!;
    const player2 = waitingPlayers.shift()!;
    
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const myTurn = Math.random() < 0.5;
    
    // 각 플레이어에게 올바른 opponent 정보를 제공하기 위해
    // 두 개의 별도 매치 데이터를 생성
    const matchData1: MatchData = {
      roomId,
      players: [player1, player2],
      opponent: player2,  // player1의 관점에서 player2가 opponent
      myTurn: myTurn
    };
    
    const matchData2: MatchData = {
      roomId,
      players: [player1, player2],
      opponent: player1,  // player2의 관점에서 player1이 opponent
      myTurn: !myTurn
    };

    // roomId를 키로 하되, 각 플레이어별로 다른 매치 데이터 저장
    activeMatches.set(`${roomId}_${player1.id}`, matchData1);
    activeMatches.set(`${roomId}_${player2.id}`, matchData2);
    
    console.log('🎯 Match created:', roomId, 'Players:', [player1.nickname, player2.nickname]);
    console.log('📊 Remaining players in queue:', waitingPlayers.length);

    return matchData1; // 첫 번째 플레이어 기준으로 반환
  }
  return null;
};

export const getPlayerMatch = (playerId: string) => {
  // 해당 플레이어의 매치 데이터를 찾기 위해 playerId가 포함된 키를 찾음
  for (const [key, matchData] of Array.from(activeMatches.entries())) {
    if (key.includes(playerId)) {
      return matchData;
    }
  }
  return null;
};

// 매칭된 플레이어를 대기열에서 완전히 제거
export const removeMatchedPlayer = (playerId: string) => {
  const index = waitingPlayers.findIndex(p => p.id === playerId);
  if (index !== -1) {
    const removedPlayer = waitingPlayers.splice(index, 1)[0];
    console.log('🗑️ Matched player removed from queue:', removedPlayer.nickname);
    return true;
  }
  return false;
}; 