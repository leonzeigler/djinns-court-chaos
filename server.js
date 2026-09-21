// Djinn's Court Chaos — game server.
// Host screen + phones join via room code. Judge Djinn Ra delivers verdicts.
// Run: npm install && npm start  →  host: http://localhost:3000/host.html

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { makeCase } = require("./cases");
const { judgeVerdict } = require("./judge");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const ARGUE_SECONDS = 75;
const MAX_ROUNDS = 3;

const rooms = {};

function newCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  } while (rooms[code]);
  return code;
}

function stateFor(room, isHost) {
  const secondsLeft = room.deadline
    ? Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000))
    : 0;
  return {
    code: room.code,
    phase: room.phase, // lobby | argue | locked | verdict | over
    round: room.round,
    players: room.players.map((p) => ({ name: p.name, team: p.team })),
    scores: room.scores,
    case: room.case,
    args: isHost ? room.args : [],
    argCount: room.args.length,
    secondsLeft,
    argueSeconds: ARGUE_SECONDS,
    maxRounds: MAX_ROUNDS,
  };
}

function broadcastState(code) {
  const room = rooms[code];
  if (!room) return;
  for (const s of room.sockets) {
    s.emit("room-state", stateFor(room, !!s.data.isHost));
  }
}

function clearTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
  room.deadline = null;
}

function startCase(room) {
  clearTimer(room);
  room.round += 1;
  room.case = makeCase();
  room.case.round = room.round;
  room.args = [];
  room.phase = "argue";
  room.deadline = Date.now() + ARGUE_SECONDS * 1000;
  // Fresh arguments each round — everyone can make their case again.
  for (const s of room.sockets) {
    if (s.data && !s.data.isHost) s.data.submitted = false;
  }
  room.timer = setTimeout(() => lockArguments(room), ARGUE_SECONDS * 1000);
  io.to(room.code).emit("case-started", {
    round: room.round,
    case: room.case,
    argueSeconds: ARGUE_SECONDS,
  });
  broadcastState(room.code);
}

function lockArguments(room) {
  if (room.phase !== "argue") return;
  clearTimer(room);
  room.phase = "locked";
  io.to(room.code).emit("arguments-locked", { argCount: room.args.length });
  broadcastState(room.code);
}

io.on("connection", (socket) => {
  // ---- HOST ----
  socket.on("create-room", (cb) => {
    const code = newCode();
    rooms[code] = {
      code,
      hostId: socket.id,
      sockets: new Set([socket]),
      players: [],
      phase: "lobby",
      round: 0,
      case: null,
      args: [],
      scores: { plaintiff: 0, defendant: 0 },
      timer: null,
      deadline: null,
    };
    socket.join(code);
    socket.data = { code, isHost: true };
    cb({ code });
  });

  // Host re-attaches after a page refresh.
  socket.on("host-join", ({ code }, cb) => {
    code = (code || "").toUpperCase().trim();
    const room = rooms[code];
    if (!room) return cb({ error: "Courtroom not found." });
    room.hostId = socket.id;
    room.sockets.add(socket);
    socket.join(code);
    socket.data = { code, isHost: true };
    cb({ ok: true, state: stateFor(room, true) });
  });

  socket.on("start-case", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    if (room.phase !== "lobby" && room.phase !== "verdict") {
      return cb && cb({ error: "Can't start a case right now." });
    }
    if (room.players.length < 2) {
      return cb && cb({ error: "Need at least 2 players in the courtroom." });
    }
    startCase(room);
    cb && cb({ ok: true });
  });

  socket.on("lock-arguments", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    lockArguments(room);
    cb && cb({ ok: true });
  });

  socket.on("request-verdict", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    if (room.phase !== "locked") {
      return cb && cb({ error: "Lock the arguments first." });
    }
    const verdict = judgeVerdict(room);
    room.scores[verdict.winner] += 1;
    room.phase = "verdict";
    io.to(room.code).emit("verdict", {
      verdict: verdict.text,
      winner: verdict.winner,
      scores: room.scores,
      round: room.round,
      maxRounds: MAX_ROUNDS,
    });
    broadcastState(room.code);
    cb && cb({ ok: true });
  });

  socket.on("next-case", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    if (room.phase !== "verdict") return cb && cb({ error: "No verdict yet." });
    if (room.round >= MAX_ROUNDS) {
      room.phase = "over";
      const s = room.scores;
      const champion =
        s.plaintiff === s.defendant ? "draw" : s.plaintiff > s.defendant ? "plaintiff" : "defendant";
      io.to(room.code).emit("game-over", { scores: s, champion });
    } else {
      startCase(room);
    }
    broadcastState(room.code);
    cb && cb({ ok: true });
  });

  socket.on("end-game", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    clearTimer(room);
    room.phase = "over";
    const s = room.scores;
    const champion =
      s.plaintiff === s.defendant ? "draw" : s.plaintiff > s.defendant ? "plaintiff" : "defendant";
    io.to(room.code).emit("game-over", { scores: s, champion });
    broadcastState(room.code);
    cb && cb({ ok: true });
  });

  // ---- PLAYER ----
  socket.on("join-room", ({ code, name }, cb) => {
    code = (code || "").toUpperCase().trim();
    const room = rooms[code];
    if (!room) return cb({ error: "Courtroom not found. Check the code." });
    name = (name || "Player").trim().slice(0, 16) || "Player";
    const plaintiffs = room.players.filter((p) => p.team === "plaintiff").length;
    const defendants = room.players.length - plaintiffs;
    const team = plaintiffs <= defendants ? "plaintiff" : "defendant";
    room.players.push({ id: socket.id, name, team });
    room.sockets.add(socket);
    socket.join(code);
    socket.data = { code, name, team, submitted: false };
    io.to(code).emit("players-updated", {
      players: room.players.map((p) => ({ name: p.name, team: p.team })),
    });
    cb({ ok: true, name, team, code, state: stateFor(room, false) });
  });

  socket.on("submit-argument", ({ text }, cb) => {
    const d = socket.data || {};
    const room = rooms[d.code];
    if (!room || d.isHost) return cb({ error: "Only players can argue." });
    if (room.phase !== "argue") return cb({ error: "Arguments are closed." });
    if (d.submitted) return cb({ error: "You already made your case!" });
    text = (text || "").trim().slice(0, 280);
    if (!text) return cb({ error: "Write something first, counselor." });
    d.submitted = true;
    room.args.push({ name: d.name, team: d.team, text });
    io.to(room.code).emit("argument", {
      name: d.name,
      team: d.team,
      text,
      count: room.args.length,
    });
    cb({ ok: true });
  });

  socket.on("disconnect", () => {
    const d = socket.data || {};
    const room = rooms[d.code];
    if (!room) return;
    room.sockets.delete(socket);
    if (!d.isHost) {
      room.players = room.players.filter((p) => p.id !== socket.id);
      io.to(room.code).emit("players-updated", {
        players: room.players.map((p) => ({ name: p.name, team: p.team })),
      });
    }
    if (room.sockets.size === 0) {
      clearTimer(room);
      delete rooms[d.code];
    }
  });
});

server.listen(PORT, () => {
  console.log(`Djinn's Court Chaos live at http://localhost:${PORT}`);
  console.log(`Host screen: http://localhost:${PORT}/host.html`);
  console.log(`Players join: http://localhost:${PORT}/join.html`);
});
