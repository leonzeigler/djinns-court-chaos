// Judge Djinn Ra's verdict engine for Djinn's Hood Court.
//
// Template-based verdicts in Djinn Ra's voice: confident, theatrical,
// gold-dread energy. Reads the actual arguments submitted and weaves
// quotes into the ruling. The judging is gloriously chaotic — the side
// with more arguments gets a slight edge, but Djinn Ra rules by vibe.
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
  "ORDER IN THE COURT! Djinn Ra has heard four rounds of arguments, and the gold dreads don't lie.",
  "*BANG BANG* — the gavel has spoken! Djinn Ra has weighed all four rounds of evidence.",
  "Court is now in session, and Judge Djinn Ra don't play about justice.",
  "Djinn Ra reviewed every word from all four rounds. The verdict is in, and it is FINAL.",
  "Silence! Djinn Ra has deliberated through four rounds, and the streets demanded a ruling.",
];

const QUIPS = [
  "When {name} said \"{quote}\" — the whole courtroom felt that.",
  "{name} came in hot with \"{quote}\" and Djinn Ra respects the boldness.",
  "Exhibit A: {name} testified \"{quote}\". Djinn Ra wrote that one down.",
  "\"{quote}\" — {name}'s words, not mine. But they hit different.",
];

const CLOSERS_WIN_P = [
  "The PLAINTIFF squad WINS THE CASE! Justice served, gold style.",
  "Verdict: PLAINTIFF wins the whole case! Djinn Ra awards them the golden gavel.",
  "The people have spoken through Djinn Ra — PLAINTIFF takes the case!",
];

const CLOSERS_WIN_D = [
  "The DEFENDANT squad WINS THE CASE! Dismissed with style.",
  "Verdict: DEFENDANT wins the whole case! Djinn Ra bangs the gavel — NOT guilty.",
  "Against all odds, the DEFENSE takes the case! Djinn Ra respects the hustle.",
];

const NO_ARGUMENT_QUIPS = [
  "Nobody said a WORD. Djinn Ra had to judge based on vibes alone. Chaotic. Iconic.",
  "Both sides went silent. Djinn Ra flipped a gold coin. Justice is blind AND spontaneous.",
];

function judgeVerdict(room, jury) {
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
        `Meanwhile, ${weak.name} tried it with "${snippet(weak.text, 60)}" — and Djinn Ra said: nice try, counselor.`
      );
    }
  }

  // The jury has spoken — Djinn Ra may agree or dramatically overrule.
  if (jury && jury.tally) {
    const p = jury.tally.plaintiff, d = jury.tally.defendant;
    const leader =
      p === d ? "split right down the middle at 3-3"
      : p > d ? `leaning ${p}-${d} toward the PLAINTIFF`
      : `leaning ${d}-${p} toward the DEFENDANT`;
    const agrees =
      (winner === "plaintiff" && p >= d) || (winner === "defendant" && d >= p);
    parts.push(
      agrees
        ? `The jury voted and it's ${leader} — and for once, Djinn Ra agrees with the people.`
        : `The jury voted and it's ${leader} — but Djinn Ra OVERRULES the jury! The gavel stays with the judge.`
    );
  }

  parts.push(pick(winner === "plaintiff" ? CLOSERS_WIN_P : CLOSERS_WIN_D));
  parts.push(`After ${room.round} rounds of arguments, Djinn Ra rules: ${winner.toUpperCase()} WINS THE CASE!`);

  return { winner, text: parts.join(" ") };
}

/* ---------- The Jury: 6 AI jurors with big personalities ----------
   After round 4, the jury votes before Judge Djinn Ra rules.
   Template-based like the judge — chaotic, quotable, offline-friendly. */

const JURORS = [
  {
    name: "Big Mama Ruth",
    color: 0x9b59b6,
    blurb: "Church mother. No-nonsense, sniffs out a lie from a mile away.",
    quips: [
      'Baby, when {name} said "{quote}", I felt that in my spirit. My vote: {VOTE}.',
      '{name} came with "{quote}" — and the Lord knows I can\'t argue with the truth. {VOTE}.',
      'I raised three kids on weaker testimony than tonight\'s, but {name}\'s "{quote}" had backbone. {VOTE}.',
    ],
    silent: "Nobody said a word, so I'm voting on vibes and the church announcements. {VOTE}.",
  },
  {
    name: "Unc",
    color: 0xe67e22,
    blurb: "Old head. Seen it all, respects anybody who says it with their chest.",
    quips: [
      '"{quote}" — that\'s what {name} said, and Unc respects it. {VOTE}.',
      "I've seen this movie before. {name}'s \"{quote}\" was the realest thing said all night. {VOTE}.",
      '{name} talked that talk: "{quote}". No excuses, just facts. {VOTE}.',
    ],
    silent: "Ain't nobody testify, so Unc flips a toothpick. It landed on {VOTE}.",
  },
  {
    name: "Keisha from the salon",
    color: 0xec5fa8,
    blurb: "Reads people for a living. Catches the detail everybody missed.",
    quips: [
      'Okay but did y\'all catch when {name} said "{quote}"? I clocked that immediately. {VOTE}.',
      '{name} said "{quote}" and the details don\'t lie, boo. {VOTE}.',
      'I read people for a living. {name}\'s "{quote}" told me everything. {VOTE}.',
    ],
    silent: "No testimony? Fine — I'm judging edges and energy. {VOTE}.",
  },
  {
    name: "Deacon Frye",
    color: 0x2ecc71,
    blurb: "Dramatic and preachy. Loves a redemption arc.",
    quips: [
      'And lo, {name} proclaimed "{quote}" — and the courtroom trembled! {VOTE}!',
      '"{quote}" — {name} spoke, and I do believe I saw the light. {VOTE}!',
      'Can I get a witness? {name} testified "{quote}". {VOTE}!',
    ],
    silent: "The congregation is silent... so the Deacon must decide alone. {VOTE}!",
  },
  {
    name: "Lil Tee",
    color: 0x4da3ff,
    blurb: "Young and funny. Votes for the funniest line that was also true.",
    quips: [
      'Not gonna lie, {name}\'s "{quote}" sent me. Funniest AND truest thing tonight. {VOTE}.',
      '{name} said "{quote}" and that\'s the only evidence I need. {VOTE}, no cap.',
      'Clip it! {name}: "{quote}". {VOTE} all day.',
    ],
    silent: "Nobody said nothing? That's actually hilarious. {VOTE} for the silence.",
  },
  {
    name: "Miss Petty",
    color: 0xe74c3c,
    blurb: "Petty on purpose. Holds grudges over the smallest slight.",
    quips: [
      '{name} said "{quote}" and I\'m still mad about it, which means it worked. {VOTE}.',
      'I hold grudges, and {name}\'s "{quote}" lives in my head rent-free. {VOTE}.',
      'Petty verdict: {name} won me over with "{quote}". {VOTE}.',
    ],
    silent: "Silence? Rude. I'm voting {VOTE} out of spite.",
  },
];

function juryVotes(room) {
  const args = room.args || [];
  const pArgs = args.filter((a) => a.team === "plaintiff");
  const dArgs = args.filter((a) => a.team === "defendant");
  const tally = { plaintiff: 0, defendant: 0 };

  const votes = JURORS.map((j) => {
    // Chaotic jury: the side with more arguments has an edge, but any
    // juror can go rogue on vibes.
    const lean = pArgs.length - dArgs.length + (Math.random() * 4 - 2);
    const vote = lean >= 0 ? "plaintiff" : "defendant";
    tally[vote] += 1;
    const VOTE = vote.toUpperCase();

    let quip;
    const pool = vote === "plaintiff" ? pArgs : dArgs;
    if (pool.length > 0) {
      const star = pick(pool);
      quip = pick(j.quips)
        .replace("{name}", star.name)
        .replace("{quote}", snippet(star.text, 70))
        .replaceAll("{VOTE}", VOTE);
    } else {
      quip = j.silent.replaceAll("{VOTE}", VOTE);
    }
    return { name: j.name, blurb: j.blurb, vote, quip, color: j.color };
  });

  return { votes, tally };
}

module.exports = { judgeVerdict, juryVotes };
