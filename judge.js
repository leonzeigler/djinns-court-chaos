// Judge Meta Man's verdict engine for Djinn's Court Chaos.
//
// Template-based verdicts in Meta Man's voice: confident, theatrical,
// gold-dread energy. Reads the actual arguments submitted and weaves
// quotes into the ruling. The judging is gloriously chaotic — the side
// with more arguments gets a slight edge, but Meta Man rules by vibe.
//
// SWAP-IN POINT: to upgrade to a real LLM judge later, replace the body
// of judgeVerdict() with a call to your LLM API (send the transcript,
// get back { winner, text }) and keep the same return shape.

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function snippet(text, maxLen = 90) {
  const t = (text || "").trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).replace(/\s+\S*$/, "") + "...";
}

const OPENERS = [
  "ORDER IN THE COURT! Meta Man has heard both sides, and the gold dreads don't lie.",
  "*BANG BANG* — the gavel has spoken! Meta Man has weighed the evidence.",
  "Court is now in session, and Judge Meta Man don't play about justice.",
  "Meta Man reviewed every word. The verdict is in, and it is FINAL.",
  "Silence! Meta Man has deliberated, and the streets demanded a ruling.",
];

const QUIPS = [
  "When {name} said \"{quote}\" — the whole courtroom felt that.",
  "{name} came in hot with \"{quote}\" and Meta Man respects the boldness.",
  "Exhibit A: {name} testified \"{quote}\". Meta Man wrote that one down.",
  "\"{quote}\" — {name}'s words, not mine. But they hit different.",
];

const CLOSERS_WIN_P = [
  "The PLAINTIFF squad takes this round! Justice served, gold style.",
  "Verdict: PLAINTIFF wins! Meta Man awards them the golden gavel.",
  "The people have spoken through Meta Man — PLAINTIFF takes it!",
];

const CLOSERS_WIN_D = [
  "The DEFENDANT squad takes this round! Case dismissed with style.",
  "Verdict: DEFENDANT wins! Meta Man bangs the gavel — NOT guilty.",
  "Against all odds, the DEFENSE prevails! Meta Man respects the hustle.",
];

const NO_ARGUMENT_QUIPS = [
  "Nobody said a WORD. Meta Man had to judge based on vibes alone. Chaotic. Iconic.",
  "Both sides went silent. Meta Man flipped a gold coin. Justice is blind AND spontaneous.",
];

function judgeVerdict(room) {
  const args = room.args || [];
  const pArgs = args.filter((a) => a.team === "plaintiff");
  const dArgs = args.filter((a) => a.team === "defendant");

  // Chaotic judging: more arguments = slight edge, but randomness rules.
  const pScore = pArgs.length + Math.random() * 2.5;
  const dScore = dArgs.length + Math.random() * 2.5;
  const winner = pScore >= dScore ? "plaintiff" : "defendant";

  const parts = [];
  parts.push(pick(OPENERS));

  if (args.length === 0) {
    parts.push(pick(NO_ARGUMENT_QUIPS));
  } else {
    const winArgs = winner === "plaintiff" ? pArgs : dArgs;
    if (winArgs.length > 0) {
      const star = pick(winArgs);
      parts.push(
        pick(QUIPS)
          .replace("{name}", star.name)
          .replace("{quote}", snippet(star.text))
      );
    }
    // Occasionally roast the losing side's weakest moment.
    const loseArgs = winner === "plaintiff" ? dArgs : pArgs;
    if (loseArgs.length > 0 && Math.random() < 0.6) {
      const weak = pick(loseArgs);
      parts.push(
        `Meanwhile, ${weak.name} tried it with "${snippet(weak.text, 60)}" — and Meta Man said: nice try, counselor.`
      );
    }
  }

  parts.push(pick(winner === "plaintiff" ? CLOSERS_WIN_P : CLOSERS_WIN_D));
  parts.push(`Round ${room.round} goes to the ${winner.toUpperCase()}!`);

  return { winner, text: parts.join(" ") };
}

module.exports = { judgeVerdict };
