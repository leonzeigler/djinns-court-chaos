// End-to-end test: simulates host + 2 players through a full 3-round game.
const { io } = require("socket.io-client");

const URL = "http://localhost:3000";
const emit = (sock, ev, data) =>
  new Promise((resolve) => {
    if (data === undefined) sock.emit(ev, resolve);
    else sock.emit(ev, data, resolve);
  });
const once = (sock, ev) => new Promise((resolve) => sock.once(ev, resolve));

(async () => {
  const host = io(URL);
  const p1 = io(URL);
  const p2 = io(URL);
  await Promise.all([
    once(host, "connect"),
    once(p1, "connect"),
    once(p2, "connect"),
  ]);

  const { code } = await emit(host, "create-room");
  console.log("room code:", code);

  const j1 = await emit(p1, "join-room", { code, name: "Big Dre" });
  const j2 = await emit(p2, "join-room", { code: code.toLowerCase(), name: "Tanya" });
  console.log("join1:", j1.ok, j1.team, "| join2:", j2.ok, j2.team);
  if (!j1.ok || !j2.ok) throw new Error("join failed");
  if (j1.team === j2.team) throw new Error("teams not balanced");

  const bad = await emit(p2, "join-room", { code: "ZZZZ", name: "X" });
  console.log("bad code rejected:", !!bad.error);

  const verdictTexts = [];
  p1.on("verdict", (v) => verdictTexts.push(v.verdict));

  // Round 1 starts from the lobby.
  let cs = once(p1, "case-started");
  await emit(host, "start-case");
  let started = await cs;

  for (let round = 1; round <= 3; round++) {
    console.log(`round ${round} case:`, started.case.charge.slice(0, 50));

    const a1 = await emit(p1, "submit-argument", { text: "Your honor, my client is innocent because the pizza was already cold." });
    const a2 = await emit(p2, "submit-argument", { text: "Objection! The defendant was seen licking their fingers." });
    const dup = await emit(p1, "submit-argument", { text: "again" });
    console.log("submits:", a1.ok, a2.ok, "| dup rejected:", !!dup.error);
    if (!a1.ok || !a2.ok || !dup.error) throw new Error("submit flow broken");

    const vProm = once(p1, "verdict");
    await emit(host, "lock-arguments");
    // small delay like the host page's auto-judge beat
    await new Promise((r) => setTimeout(r, 300));
    await emit(host, "request-verdict");
    const verdict = await vProm;
    console.log(`round ${round} winner:`, verdict.winner, "| scores:", JSON.stringify(verdict.scores));

    if (round < 3) {
      cs = once(p1, "case-started");
      await emit(host, "next-case");
      started = await cs;
    }
  }

  const overProm = once(p1, "game-over");
  await emit(host, "next-case");
  const over = await overProm;
  console.log("game over:", JSON.stringify(over));
  if (!["plaintiff", "defendant", "draw"].includes(over.champion)) throw new Error("bad champion");

  console.log("verdict quotes a player:", /Big Dre|Tanya/.test(verdictTexts[0]));

  host.close(); p1.close(); p2.close();
  console.log("ALL TESTS PASSED");
  process.exit(0);
})().catch((e) => { console.error("TEST FAILED:", e.message); process.exit(1); });
