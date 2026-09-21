# ⚖️ Djinn's Court Chaos

A party game for your Discord game nights. You host the courtroom on your
stream/TV, players join from their phones with a room code or QR scan —
no app, no download. Judge Meta Man hears the arguments and delivers
the verdict. In his voice.

## Run it

Needs Node.js (free download from nodejs.org — get the LTS version).

```bash
cd court-chaos-game
npm install
npm start
```

Then:
- **Host screen** (your stream/TV): http://localhost:3000/host.html
- **Players** (phones): http://localhost:3000/join.html

## How players reach it

- **Same Wi-Fi:** players open `http://YOUR-COMPUTER-IP:3000/join.html`
  (find your IP with `ipconfig` on Windows — look for IPv4 Address).
- **Remote players (Discord crew):** run a tunnel like ngrok
  (`ngrok http 3000`) and share the link it gives you. Or ask Djinni1
  to put the game on a proper server so it's always online.

## How a night goes

1. Host clicks **Create Courtroom** → big 4-letter code + QR appears.
2. Players enter the code + their name → auto-split into
   ⚖️ PLAINTIFF and 🛡️ DEFENDANT.
3. Host starts Case 1 → everyone sees the absurd charge.
4. 75 seconds: each player submits one argument from their phone.
   Arguments appear live on the host screen.
5. Host locks arguments → **Judge Meta Man delivers the verdict**,
   out loud, in his voice. Winner takes the round.
6. Best of 3 cases → champion of the night. Gavel. Adjourned.

## Judge Meta Man's voice

The verdict screen has a **voice picker**. It defaults to the deepest
male voice on the machine, slowed down and pitched low for that
heavyweight-judge feel. Pick whichever voice sounds most like him.

Want the true Brooklyn-accent deep voice? That needs a voice API
(e.g. ElevenLabs) with an API key — the `speak()` function in
`public/host.html` is the one place to wire it in later.

## Files

- `server.js` — game server (rooms, timers, scoring)
- `cases.js` — the absurd case generator (add your own charges here!)
- `judge.js` — Meta Man's verdict engine (template-based now;
  swap in a real LLM judge later — same return shape)
- `public/host.html` — the courtroom screen
- `public/join.html` — the player screen
- `public/meta-man.png` — the judge himself
- `test-game.js` — automated full-game test (`node test-game.js`
  while the server runs)
