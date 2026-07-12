import crypto from 'crypto';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3001);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const roomSecret = process.env.ROOM_SECRET || '';
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const rooms = new Map();

function normalizeRoomCode(roomCode) {
  return String(roomCode || '').trim().toUpperCase();
}

function makeRoomId(roomCode) {
  return crypto.createHash('sha1').update(roomCode).digest('hex').slice(0, 12);
}

function ensureRoom(roomCode) {
  const normalized = normalizeRoomCode(roomCode);
  if (!normalized) {
    throw new Error('Room code is required.');
  }

  if (!rooms.has(normalized)) {
    rooms.set(normalized, {
      roomId: makeRoomId(normalized),
      peers: new Set()
    });
  }

  return rooms.get(normalized);
}

function roomSnapshot(roomCode) {
  const normalized = normalizeRoomCode(roomCode);
  const room = rooms.get(normalized);
  return room
    ? { roomId: room.roomId, peers: Array.from(room.peers) }
    : { roomId: makeRoomId(normalized), peers: [] };
}

app.use(express.json({ limit: '2mb' }));

if (process.env.SERVE_CLIENT !== 'false') {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next();
    }

    return res.sendFile(path.join(clientDistPath, 'index.html'), (error) => {
      if (error) {
        next();
      }
    });
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/rooms/join', (req, res) => {
  const roomCode = normalizeRoomCode(req.body?.roomCode);
  const password = String(req.body?.password || '');

  if (!roomCode) {
    return res.status(400).json({ error: 'roomCode is required' });
  }

  if (roomSecret && password !== roomSecret) {
    return res.status(401).json({ error: 'invalid room password' });
  }

  const room = ensureRoom(roomCode);
  return res.json({
    roomCode,
    ...roomSnapshot(roomCode),
    peerCount: room.peers.size
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  socket.data.roomCode = null;
  socket.data.lastPingAt = Date.now();

  socket.on('room:join', (payload = {}, ack = () => {}) => {
    try {
      const roomCode = normalizeRoomCode(payload.roomCode);
      const password = String(payload.password || '');

      if (!roomCode) {
        return ack({ ok: false, error: 'roomCode is required' });
      }

      if (roomSecret && password !== roomSecret) {
        return ack({ ok: false, error: 'invalid room password' });
      }

      const room = ensureRoom(roomCode);
      if (room.peers.size >= 2 && !room.peers.has(socket.id)) {
        return ack({ ok: false, error: 'room is full' });
      }

      socket.join(roomCode);
      room.peers.add(socket.id);
      socket.data.roomCode = roomCode;

      socket.to(roomCode).emit('peer:joined', { peerId: socket.id });

      ack({
        ok: true,
        roomCode,
        peerId: socket.id,
        peerCount: room.peers.size,
        ...roomSnapshot(roomCode)
      });
    } catch (error) {
      ack({ ok: false, error: error.message });
    }
  });

  socket.on('signal:offer', ({ roomCode, sdp }) => {
    socket.to(normalizeRoomCode(roomCode)).emit('signal:offer', {
      peerId: socket.id,
      sdp
    });
  });

  socket.on('signal:answer', ({ roomCode, sdp }) => {
    socket.to(normalizeRoomCode(roomCode)).emit('signal:answer', {
      peerId: socket.id,
      sdp
    });
  });

  socket.on('signal:ice', ({ roomCode, candidate }) => {
    socket.to(normalizeRoomCode(roomCode)).emit('signal:ice', {
      peerId: socket.id,
      candidate
    });
  });

  socket.on('heartbeat:ping', (_payload, ack = () => {}) => {
    ack({ ok: true, serverTime: Date.now() });
  });

  socket.on('chat:message', ({ roomCode, message }) => {
    socket.to(normalizeRoomCode(roomCode)).emit('chat:message', {
      peerId: socket.id,
      message,
      createdAt: Date.now()
    });
  });

  socket.on('voice:message', ({ roomCode, chunkId, data }) => {
    socket.to(normalizeRoomCode(roomCode)).emit('voice:message', {
      peerId: socket.id,
      chunkId,
      data,
      createdAt: Date.now()
    });
  });

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (roomCode && rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      room.peers.delete(socket.id);
      socket.to(roomCode).emit('peer:left', { peerId: socket.id });
      if (room.peers.size === 0) {
        rooms.delete(roomCode);
      }
    }
  });
});

server.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
