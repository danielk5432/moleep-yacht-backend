// pages/api/socket.ts

import { Server } from 'socket.io';
import type { NextApiRequest, NextApiResponse } from 'next';
import { 
    Player, 
    addToQueue, 
    tryMatchMaking,
    getMatchByRoomId, // ✅ import 추가
    GOOD_DICE_DATA
} from './multiplayer/match-state.ts';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { Server as IOServer } from 'socket.io';

// --- 타입 정의 ---
interface SocketServer extends HTTPServer { io?: IOServer | undefined; }
interface SocketWithIO extends NetSocket { server: SocketServer; }
interface NextApiResponseWithSocket extends NextApiResponse { socket: SocketWithIO; }

// --- 전역 맵 ---
const playerSocketMap = new Map<string, string>();

export default function socketHandler(req: NextApiRequest, res: NextApiResponseWithSocket) {
    if (res.socket.server.io) {
        console.log('Socket is already running.');
    } else {
        console.log('Socket is initializing...');
        const io = new Server(res.socket.server);
        res.socket.server.io = io;

        io.on('connection', (socket) => {
            console.log(`Socket connected: ${socket.id}`);

            // 1. 플레이어 등록: 클라이언트가 연결되면 자신의 ID를 서버에 알림
            socket.on('register', (playerId: string) => {
                playerSocketMap.set(playerId, socket.id);
                console.log(`Player ${playerId} registered with socket ${socket.id}`);
            });

            // 2. 매칭 요청 처리 (기존 POST /api/match 로직 대체)
            socket.on('matchmaking:joinQueue', (playerData) => {
                const { playerId, nickname, goodDiceRecord } = playerData;

                if (!playerId || !nickname || !goodDiceRecord || !validateDiceRecord(goodDiceRecord)) {
                    // 유효하지 않은 요청은 해당 클라이언트에게만 에러를 보냄
                    socket.emit('error', { message: 'Invalid request data.' });
                    return;
                }

                const player: Player = { id: playerId, nickname, joinedAt: new Date(), goodDiceRecord };
                
                // 대기열 추가 및 매칭 시도
                addToQueue(player);
                const matchData = tryMatchMaking(); // 4명이 모이면 matchData가 생성됨

                if (matchData) {
                    // 매칭 성공! 관련된 4명의 플레이어에게 알림
                    console.log(`Match found: ${matchData.roomId}. Notifying players.`);
                    
                    matchData.players.forEach(p => {
                        const playerSocketId = playerSocketMap.get(p.id);
                        if (playerSocketId) {
                            const playerSocket = io.sockets.sockets.get(playerSocketId);
                            // 각 플레이어를 새로운 게임 방에 참가시킴
                            playerSocket?.join(matchData.roomId);
                        }
                    });

                    // 해당 방에 있는 모든 플레이어에게 매칭 완료 이벤트 전송
                    io.to(matchData.roomId).emit('matchmaking:matched', matchData);
                } else {
                    // 아직 매칭되지 않음, 요청한 클라이언트에게 대기 상태 알림
                    socket.emit('matchmaking:waiting');
                }
            });

            // --- 이하 게임 진행 관련 이벤트 핸들러 (기존과 유사) ---
            socket.on('roulette:getDice', (roomId, callback) => { /* ... */ });
            socket.on('roulette:selectDice', (data) => { /* ... */ });
            socket.on('score:update', (data) => { /* ... */ });

            socket.on('disconnect', () => {
                // 연결이 끊어지면 맵에서 해당 플레이어 제거
                playerSocketMap.forEach((socketId, playerId) => {
                    if (socketId === socket.id) {
                    playerSocketMap.delete(playerId);
                    console.log(`Player ${playerId} unregistered.`);
                    }
                });
                console.log(`Socket disconnected: ${socket.id}`);
                });
        });
    }
    res.end();
}