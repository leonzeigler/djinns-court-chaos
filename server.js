// Djinn's Hood Court — game server.
// Host screen + phones join via room code. Judge Djinn Ra delivers verdicts.
// Run: npm install && npm start  →  host: http://localhost:3000/host.html

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Server } = require("socket.io");
const { makeCase } = require("./cases");
const { judgeVerdict, juryVotes } = require("./judge");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "64kb" }));

/* ---------- Judge Djinn Ra's AI voice (ElevenLabs) ----------
   POST /api/say { text } -> MP3 audio of the judge speaking.
   Uses Leon's cloned voice when JUDGE_VOICE_ID is set, otherwise a
   deep male stock voice. Needs ELEVENLABS_API_KEY env var.
   Responses are cached on disk by (voice, text) hash. */
const VOICE_CACHE = path.join(__dirname, ".voice-cache");
try { fs.mkdirSync(VOICE_CACHE, { recursive: true }); } catch (_) {}
const DEFAULT_VOICE_ID = "DZaTfsVlJ2F1k152TYf7"; // Leon's Court Chaos Instant Voice Clone; JUDGE_VOICE_ID env overrides

app.post("/api/say", async (req, res) => {
  const text = String((req.body && req.body.text) || "").slice(0, 1200);
  if (!text.trim()) return res.status(400).json({ error: "no-text" });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "no-voice-key" });
  const voiceId = process.env.JUDGE_VOICE_ID || DEFAULT_VOICE_ID;
  const hash = crypto.createHash("sha1").update(voiceId + ":" + text).digest("hex");
  const file = path.join(VOICE_CACHE, hash + ".mp3");
  if (fs.existsSync(file)) {
    res.set("Content-Type", "audio/mpeg");
    return res.sendFile(file);
  }
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + voiceId, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return res.status(502).json({ error: "tts-failed", detail: detail.slice(0, 200) });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    try { fs.writeFileSync(file, buf); } catch (_) {}
    res.set("Content-Type", "audio/mpeg");
    res.send(buf);
  } catch (e) {
    res.status(502).json({ error: "tts-error" });
  }
});

const PORT = process.env.PORT || 3000;
const ARGUE_SECONDS = 75;
const MAX_ROUNDS = 4; // one case, four rounds of arguments, one final verdict

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
    phase: room.phase, // lobby | argue | locked | halftime | jury | verdict | over
    round: room.round,
    players: room.players.map((p) => ({ name: p.name, team: p.team })),
    scores: room.scores,
    case: room.case,
    args: isHost ? room.args : [],
    argCount: room.args.length,
    jury: room.jury,
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

// One case per game. Round 1 draws the case; rounds 2-4 argue the SAME case.
// Arguments accumulate across all rounds — the judge weighs everything
// at the end and delivers a single final verdict.
function startGame(room) {
  clearTimer(room);
  room.round = 1;
  room.case = makeCase();
  room.args = [];
  room.jury = null;
  beginRound(room);
}

function nextRound(room) {
  room.round += 1;
  beginRound(room);
}

function beginRound(room) {
  clearTimer(room);
  room.case.round = room.round;
  room.phase = "argue";
  room.deadline = Date.now() + ARGUE_SECONDS * 1000;
  // Fresh arguments each round — everyone can make their case again.
  for (const s of room.sockets) {
    if (s.data && !s.data.isHost) s.data.submitted = false;
  }
  room.timer = setTimeout(() => lockArguments(room), ARGUE_SECONDS * 1000);
  io.to(room.code).emit("case-started", {
    round: room.round,
    maxRounds: MAX_ROUNDS,
    case: room.case,
    argueSeconds: ARGUE_SECONDS,
  });
  broadcastState(room.code);
}

function lockArguments(room) {
  if (room.phase !== "argue") return;
  clearTimer(room);
  room.phase = "locked";
  io.to(room.code).emit("arguments-locked", {
    argCount: room.args.length,
    round: room.round,
    maxRounds: MAX_ROUNDS,
  });
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
      jury: null, // 6 AI jurors vote after round 4, before the judge rules
      scores: { plaintiff: 0, defendant: 0 },
      timer: null,
      deadline: null,
      hostGoneTimer: null, // grace period for host re-attach (see disconnect)
    };
    socket.join(code);
    socket.data = { code, isHost: true };
    cb({ code });
  });

  // Host re-attaches after a page refresh (or a dropped connection).
  socket.on("host-join", ({ code }, cb) => {
    code = (code || "").toUpperCase().trim();
    const room = rooms[code];
    if (!room) return cb({ error: "Courtroom not found." });
    // Host is back inside the grace period — cancel room deletion.
    if (room.hostGoneTimer) {
      clearTimeout(room.hostGoneTimer);
      room.hostGoneTimer = null;
    }
    room.hostId = socket.id;
    room.sockets.add(socket);
    socket.join(code);
    socket.data = { code, isHost: true };
    cb({ ok: true, state: stateFor(room, true) });
  });

  socket.on("start-case", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    if (room.phase !== "lobby") {
      return cb && cb({ error: "Can't start a case right now." });
    }
    if (room.players.length < 2) {
      return cb && cb({ error: "Need at least 2 players in the courtroom." });
    }
    startGame(room);
    cb && cb({ ok: true });
  });

  socket.on("lock-arguments", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    lockArguments(room);
    cb && cb({ ok: true });
  });

  // Advance to the next round of the SAME case (rounds 1-3).
  // Like basketball: rounds 1-2, halftime, rounds 3-4.
  socket.on("next-round", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    if (room.phase !== "locked") return cb && cb({ error: "Lock the arguments first." });
    if (room.round >= MAX_ROUNDS) {
      return cb && cb({ error: "All four rounds are done — ask for the verdict." });
    }
    if (room.round === 2) {
      // Halftime after round 2.
      clearTimer(room);
      room.phase = "halftime";
      io.to(room.code).emit("halftime", { round: 2, maxRounds: MAX_ROUNDS });
      broadcastState(room.code);
      cb && cb({ ok: true });
      return;
    }
    nextRound(room);
    cb && cb({ ok: true });
  });

  // Halftime's over — start round 3.
  socket.on("end-halftime", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    if (room.phase !== "halftime") return cb && cb({ error: "Not halftime." });
    nextRound(room);
    cb && cb({ ok: true });
  });

  // After round 4: the 6 AI jurors deliberate and vote, then the judge rules.
  socket.on("start-jury", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    if (room.phase !== "locked") return cb && cb({ error: "Lock the arguments first." });
    if (room.round < MAX_ROUNDS) {
      return cb && cb({ error: "The jury votes after round 4." });
    }
    room.phase = "jury";
    const jury = juryVotes(room);
    room.jury = jury;
    io.to(room.code).emit("jury-votes", jury);
    broadcastState(room.code);
    cb && cb({ ok: true });
  });

  socket.on("request-verdict", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    if (room.round < MAX_ROUNDS) {
      return cb && cb({ error: "The judge rules after round 4." });
    }
    if (room.phase !== "jury" || !room.jury) {
      return cb && cb({ error: "The jury has to vote first." });
    }
    const verdict = judgeVerdict(room, room.jury);
    room.scores[verdict.winner] += 1;
    room.phase = "verdict";
    io.to(room.code).emit("verdict", {
      verdict: verdict.text,
      winner: verdict.winner,
      scores: room.scores,
      round: room.round,
      maxRounds: MAX_ROUNDS,
      tally: room.jury.tally,
    });
    broadcastState(room.code);
    cb && cb({ ok: true });
  });

  // After the final verdict: crown the winner, court adjourned.
  socket.on("next-case", (cb) => {
    const room = rooms[socket.data?.code];
    if (!room || !socket.data?.isHost) return cb && cb({ error: "Not the host." });
    if (room.phase !== "verdict") return cb && cb({ error: "No verdict yet." });
    room.phase = "over";
    const s = room.scores;
    const champion =
      s.plaintiff === s.defendant ? "draw" : s.plaintiff > s.defendant ? "plaintiff" : "defendant";
    io.to(room.code).emit("game-over", { scores: s, champion });
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
    room.args.push({ name: d.name, team: d.team, text, round: room.round });
    io.to(room.code).emit("argument", {
      name: d.name,
      team: d.team,
      text,
      round: room.round,
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
    } else {
      // The host dropped (refresh, hiccup, closed tab). Don't kill the
      // courtroom instantly — give the host 2 minutes to re-attach.
      if (room.hostGoneTimer) clearTimeout(room.hostGoneTimer);
      room.hostGoneTimer = setTimeout(() => {
        clearTimer(room);
        delete rooms[d.code];
      }, 120000);
    }
    // Only delete an empty room immediately when no host grace period
    // is pending — otherwise the grace timer cleans it up.
    if (room.sockets.size === 0 && !room.hostGoneTimer) {
      clearTimer(room);
      delete rooms[d.code];
    }
  });
});

server.listen(PORT, () => {
  console.log(`Djinn's Hood Court live at http://localhost:${PORT}`);
  console.log(`Host screen: http://localhost:${PORT}/host.html`);
  console.log(`Players join: http://localhost:${PORT}/join.html`);
});
