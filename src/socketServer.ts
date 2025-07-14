const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

/** 타입 명시 */
interface WaitingPlayer {
  socket: typeof io.Socket;
  nickname: string;
}
let waitingQueue: WaitingPlayer[] = [];
let roomCounter = 1;

io.on("connection", (socket: any) => {
  console.log("Socket connected:", socket.id);

  socket.on("match:join", (payload: { nickname: string }) => {
    waitingQueue.push({ socket, nickname: payload.nickname });
    while (waitingQueue.length >= 2) {
      const player1 = waitingQueue.shift()!;
      const player2 = waitingQueue.shift()!;
      const roomId = `room-${roomCounter++}`;
      player1.socket.join(roomId);
      player2.socket.join(roomId);
      player1.socket.emit("match:matched", { roomId, opponent: player2.nickname });
      player2.socket.emit("match:matched", { roomId, opponent: player1.nickname });
    }
  });

  socket.on("match:cancel", () => {
    waitingQueue = waitingQueue.filter((entry) => entry.socket.id !== socket.id);
  });

  socket.on("disconnect", () => {
    waitingQueue = waitingQueue.filter((entry) => entry.socket.id !== socket.id);
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
}); 