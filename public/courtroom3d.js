// Djinn's Hood Court — 3D virtual courtroom (Three.js).
// Rendered behind the host screen: Judge Djinn Ra at the bench,
// 6 AI jurors in the jury box, plaintiff/defendant tables.
// Exposes window.Courtroom3D with: init, setMode, showArgument,
// resetJury, revealJurorVote, gavelBang, resize.

import * as THREE from "three";

const GOLD = 0xf5c518;
const WOOD = 0x4a2f1d;
const WOOD_DARK = 0x2a1a10;
const PLAINTIFF_C = 0xf5c518;
const DEFENDANT_C = 0x4da3ff;

function makeLabel(text, { size = 44, color = "#f5c518", bg = null } = {}) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 512, 128); }
  g.font = `900 ${size}px Cinzel, Georgia, serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 8; g.strokeStyle = "rgba(0,0,0,0.85)";
  g.strokeText(text, 256, 64);
  g.fillStyle = color;
  g.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  sp.scale.set(3.4, 0.85, 1);
  return sp;
}

function makeBadge(team) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const g = c.getContext("2d");
  g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fillStyle = team === "plaintiff" ? "#f5c518" : "#4da3ff";
  g.fill();
  g.lineWidth = 6; g.strokeStyle = "#111"; g.stroke();
  g.font = "64px serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(team === "plaintiff" ? "⚖️" : "🛡️", 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  m.visible = false;
  return m;
}

// ---------- cartoon faces ----------
// Each juror (and each contestant) gets a hand-drawn canvas face so they
// read as characters, not chess pieces. Faces are billboard sprites —
// always turned toward the camera, like a game HUD.
function _feyes(g, cx, cy, style) {
  const y = cy - 8;
  if (style === "shades") {
    g.fillStyle = "#0a0a0a";
    g.beginPath(); g.ellipse(cx - 30, y, 24, 15, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + 30, y, 24, 15, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(cx - 8, y - 6, 16, 7);
    g.fillStyle = "rgba(255,255,255,0.28)";
    g.fillRect(cx - 48, y - 10, 13, 6); g.fillRect(cx + 14, y - 10, 13, 6);
    return;
  }
  if (style === "laugh") {
    g.strokeStyle = "#140c06"; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath(); g.arc(cx - 30, y, 14, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
    g.beginPath(); g.arc(cx + 30, y, 14, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
    return;
  }
  g.fillStyle = "#fff";
  g.beginPath(); g.ellipse(cx - 30, y, 17, 13, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 30, y, 17, 13, 0, 0, Math.PI * 2); g.fill();
  let dx = 0, dy = 0;
  if (style === "side") dx = 9;
  if (style === "up") dy = -4;
  g.fillStyle = "#140c06";
  g.beginPath(); g.arc(cx - 30 + dx, y + dy, 6.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + 30 + dx, y + dy, 6.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff";
  g.beginPath(); g.arc(cx - 32 + dx, y + dy - 2, 2.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + 28 + dx, y + dy - 2, 2.2, 0, Math.PI * 2); g.fill();
}
function _fbrows(g, cx, cy, style, color = "#14100c") {
  g.strokeStyle = color; g.lineCap = "round";
  const y = cy - 36;
  if (style === "stern") {
    g.lineWidth = 8;
    g.beginPath(); g.moveTo(cx - 50, y - 4); g.lineTo(cx - 12, y + 7); g.stroke();
    g.beginPath(); g.moveTo(cx + 50, y - 4); g.lineTo(cx + 12, y + 7); g.stroke();
  } else if (style === "arched") {
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx - 48, y + 5); g.quadraticCurveTo(cx - 30, y - 12, cx - 12, y); g.stroke();
    g.beginPath(); g.moveTo(cx + 48, y + 5); g.quadraticCurveTo(cx + 30, y - 12, cx + 12, y); g.stroke();
  } else {
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx - 48, y); g.lineTo(cx - 12, y - 2); g.stroke();
    g.beginPath(); g.moveTo(cx + 48, y); g.lineTo(cx + 12, y - 2); g.stroke();
  }
}
function _fmouth(g, cx, cy, style) {
  const y = cy + 46;
  g.lineCap = "round";
  if (style === "smile") {
    g.strokeStyle = "#5e2417"; g.lineWidth = 6;
    g.beginPath(); g.arc(cx, y - 10, 26, Math.PI * 0.22, Math.PI * 0.78); g.stroke();
  } else if (style === "smirk") {
    g.strokeStyle = "#5e2417"; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx - 22, y); g.quadraticCurveTo(cx + 8, y + 7, cx + 28, y - 11); g.stroke();
  } else if (style === "stern") {
    g.strokeStyle = "#4a1c12"; g.lineWidth = 7;
    g.beginPath(); g.moveTo(cx - 24, y); g.lineTo(cx + 24, y); g.stroke();
  } else if (style === "flat") {
    g.strokeStyle = "#4a1c12"; g.lineWidth = 5;
    g.beginPath(); g.moveTo(cx - 20, y); g.lineTo(cx + 20, y); g.stroke();
  } else if (style === "open") {
    g.fillStyle = "#5e2417";
    g.beginPath(); g.ellipse(cx, y, 16, 21, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#b04a3a";
    g.beginPath(); g.ellipse(cx, y + 8, 9, 10, 0, 0, Math.PI * 2); g.fill();
  } else if (style === "lips") {
    g.fillStyle = "#c0272d";
    g.beginPath(); g.ellipse(cx, y, 25, 13, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#7d1418"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - 25, y); g.lineTo(cx + 25, y); g.stroke();
  }
}
function _fglasses(g, cx, cy) {
  const y = cy - 8;
  g.strokeStyle = "#e8dcc0"; g.lineWidth = 5;
  g.strokeRect(cx - 52, y - 16, 42, 31);
  g.strokeRect(cx + 10, y - 16, 42, 31);
  g.beginPath(); g.moveTo(cx - 10, y); g.lineTo(cx + 10, y); g.stroke();
}
function _fgoatee(g, cx, cy, color) {
  g.fillStyle = color;
  g.beginPath(); g.ellipse(cx, cy + 78, 19, 24, 0, 0, Math.PI * 2); g.fill();
}
function _fmustache(g, cx, cy, color) {
  g.fillStyle = color;
  g.beginPath(); g.ellipse(cx - 15, cy + 30, 17, 7, -0.18, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 15, cy + 30, 17, 7, 0.18, 0, Math.PI * 2); g.fill();
}
function _fhoops(g, cx, cy) {
  g.strokeStyle = "#f5c518"; g.lineWidth = 6;
  g.beginPath(); g.arc(cx - 94, cy + 34, 14, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(cx + 94, cy + 34, 14, 0, Math.PI * 2); g.stroke();
}

// Juror faces, matched to the AI personas in judge.js.
const JUROR_FACES = [
  { // Big Mama Ruth — church mother, no-nonsense
    persona: "sway", skin: "#8a5636",
    back(g, cx, cy) {
      g.fillStyle = "#d9d9d9";
      g.beginPath(); g.arc(cx, cy - 78, 34, 0, Math.PI * 2); g.fill(); // bun
      g.beginPath(); g.arc(cx, cy - 6, 94, Math.PI, 0); g.fill();       // gray cap
    },
    features(g, cx, cy) {
      _feyes(g, cx, cy, "soft"); _fbrows(g, cx, cy, "soft", "#8a8a8a");
      _fglasses(g, cx, cy); _fmouth(g, cx, cy, "smile");
      g.fillStyle = "#f2ead8"; // pearl earrings
      g.beginPath(); g.arc(cx - 90, cy + 40, 6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + 90, cy + 40, 6, 0, Math.PI * 2); g.fill();
    },
  },
  { // Unc — old head, seen it all
    persona: "lean", skin: "#6b3f24",
    features(g, cx, cy) {
      _feyes(g, cx, cy, "shades");
      _fmouth(g, cx, cy, "flat");
      _fgoatee(g, cx, cy, "#cfcfcf");
    },
    front(g, cx, cy) { // snapback cap
      g.fillStyle = "#b91c1c";
      g.beginPath(); g.arc(cx, cy - 26, 88, Math.PI, 0); g.fill();
      g.fillStyle = "#7a1010";
      g.fillRect(cx - 88, cy - 52, 176, 15);
      g.fillStyle = "#f5c518";
      g.beginPath(); g.arc(cx, cy - 96, 9, 0, Math.PI * 2); g.fill();
    },
  },
  { // Keisha from the salon — reads people for a living
    persona: "bob", skin: "#7a4a2c",
    back(g, cx, cy) {
      g.fillStyle = "#7a2f16";
      g.beginPath(); g.ellipse(cx, cy + 12, 102, 108, 0, 0, Math.PI * 2); g.fill(); // bob
    },
    features(g, cx, cy) {
      _feyes(g, cx, cy, "keen"); _fbrows(g, cx, cy, "arched");
      _fmouth(g, cx, cy, "smile"); _fhoops(g, cx, cy);
    },
    front(g, cx, cy) {
      g.fillStyle = "#7a2f16";
      g.beginPath(); g.arc(cx, cy - 22, 88, Math.PI * 1.02, Math.PI * 1.98); g.fill(); // swoop
    },
  },
  { // Deacon Frye — dramatic and preachy
    persona: "nod", skin: "#5e3720",
    features(g, cx, cy) {
      _feyes(g, cx, cy, "up"); _fbrows(g, cx, cy, "arched");
      _fglasses(g, cx, cy); _fmustache(g, cx, cy, "#1c1c1c");
      _fmouth(g, cx, cy, "open");
      g.fillStyle = "rgba(255,255,255,0.18)"; // bald shine
      g.beginPath(); g.ellipse(cx - 24, cy - 62, 26, 14, -0.4, 0, Math.PI * 2); g.fill();
    },
  },
  { // Lil Tee — young and funny
    persona: "bounce", skin: "#4e2f1c",
    back(g, cx, cy) {
      g.fillStyle = "#151515";
      g.beginPath(); g.arc(cx, cy - 4, 94, Math.PI * 0.95, Math.PI * 2.05); g.fill(); // durag
      g.beginPath(); g.arc(cx, cy - 96, 12, 0, Math.PI * 2); g.fill();                // knot
      g.strokeStyle = "#151515"; g.lineWidth = 12; g.lineCap = "round";
      g.beginPath(); g.moveTo(cx, cy - 88); g.lineTo(cx + 26, cy - 60); g.stroke();    // tail
    },
    features(g, cx, cy) {
      _feyes(g, cx, cy, "laugh"); _fbrows(g, cx, cy, "soft");
      _fmouth(g, cx, cy, "smirk");
      g.fillStyle = "#f5c518"; // gold tooth
      g.fillRect(cx + 12, cy + 44, 8, 8);
    },
  },
  { // Miss Petty — petty on purpose
    persona: "shake", skin: "#8a5636",
    back(g, cx, cy) {
      g.fillStyle = "#101010";
      g.beginPath(); g.ellipse(cx, cy + 26, 106, 122, 0, 0, Math.PI * 2); g.fill(); // long hair
    },
    features(g, cx, cy) {
      _feyes(g, cx, cy, "side"); _fbrows(g, cx, cy, "arched");
      _fmouth(g, cx, cy, "lips");
    },
    front(g, cx, cy) {
      g.fillStyle = "#101010";
      g.beginPath(); g.arc(cx - 30, cy - 30, 70, Math.PI * 1.1, Math.PI * 1.9); g.fill();
      g.beginPath(); g.arc(cx + 30, cy - 30, 70, Math.PI * 1.1, Math.PI * 1.9); g.fill();
    },
  },
];

// Contestant faces — the people actually on trial.
const CONTESTANT_FACES = {
  plaintiff: {
    skin: "#6b3f24",
    back(g, cx, cy) {
      g.fillStyle = "#161616";
      g.beginPath(); g.arc(cx, cy - 8, 92, Math.PI * 0.98, Math.PI * 2.02); g.fill(); // fade
    },
    features(g, cx, cy) {
      _feyes(g, cx, cy, "stern"); _fbrows(g, cx, cy, "stern");
      _fmouth(g, cx, cy, "flat");
    },
  },
  defendant: {
    skin: "#8a5636",
    back(g, cx, cy) {
      g.fillStyle = "#0f0f0f";
      g.beginPath(); g.arc(cx, cy - 10, 92, Math.PI, 0); g.fill();
    },
    features(g, cx, cy) {
      _feyes(g, cx, cy, "side"); _fbrows(g, cx, cy, "arched");
      _fmouth(g, cx, cy, "smirk");
      _fgoatee(g, cx, cy, "#0f0f0f");
    },
    front(g, cx, cy) {
      g.fillStyle = "#0f0f0f";
      g.beginPath(); g.arc(cx - 34, cy - 34, 60, Math.PI * 1.15, Math.PI * 1.85); g.fill(); // side part
    },
  },
};

function makeFace(def, scale = 1.15) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  const cx = 128, cy = 132;
  if (def.back) def.back(g, cx, cy);
  g.fillStyle = def.skin;
  g.beginPath(); g.arc(cx, cy, 88, 0, Math.PI * 2); g.fill();
  def.features(g, cx, cy);
  if (def.front) def.front(g, cx, cy);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  sp.scale.set(scale, scale, 1);
  return sp;
}

const Courtroom3D = {
  ready: false,
  _bubbles: [],
  _jurors: [],
  _contestants: {},
  _shake: 0,
  _dimTarget: 1,
  _gavelT: -1,

  init(container) {
    this.container = container;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0b0705, 24, 46);
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    this.cameraBase = new THREE.Vector3(0, 4.4, 11.5);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(0, 1.8, -5);

    // ---------- lights ----------
    this.ambient = new THREE.AmbientLight(0xffe9c4, 0.55);
    this.scene.add(this.ambient);
    this.key = new THREE.SpotLight(0xfff2d9, 900, 60, Math.PI / 5, 0.45);
    this.key.position.set(0, 14, 8);
    this.key.target.position.set(0, 0, -6);
    this.scene.add(this.key, this.key.target);
    this.judgeSpot = new THREE.SpotLight(0xffd76a, 700, 30, Math.PI / 7, 0.5);
    this.judgeSpot.position.set(0, 10, -6);
    this.judgeSpot.target.position.set(0, 2.5, -10);
    this.scene.add(this.judgeSpot, this.judgeSpot.target);
    this.jurySpot = new THREE.SpotLight(0xfff2d9, 250, 30, Math.PI / 6, 0.5);
    this.jurySpot.position.set(10, 9, -4);
    this.jurySpot.target.position.set(11, 1, -5);
    this.scene.add(this.jurySpot, this.jurySpot.target);
    this.goldGlow = new THREE.PointLight(GOLD, 60, 25);
    this.goldGlow.position.set(0, 6, -9);
    this.scene.add(this.goldGlow);

    // ---------- room ----------
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 34),
      new THREE.MeshStandardMaterial({ color: 0x3a2417, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.9 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(44, 14, 1), wallMat);
    backWall.position.set(0, 7, -14.5);
    this.scene.add(backWall);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(1, 14, 34), wallMat);
    sideL.position.set(-16, 7, 0);
    this.scene.add(sideL);
    const sideR = sideL.clone();
    sideR.position.x = 16;
    this.scene.add(sideR);
    // gold trim along the back wall
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(44, 0.35, 0.2),
      new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.35, metalness: 0.7 })
    );
    trim.position.set(0, 5.6, -13.9);
    this.scene.add(trim);

    // wall sign
    const signC = document.createElement("canvas");
    signC.width = 1024; signC.height = 200;
    const sg = signC.getContext("2d");
    sg.fillStyle = "#120b06"; sg.fillRect(0, 0, 1024, 200);
    sg.strokeStyle = "#f5c518"; sg.lineWidth = 10; sg.strokeRect(12, 12, 1000, 176);
    sg.font = "900 92px Cinzel, Georgia, serif";
    sg.textAlign = "center"; sg.textBaseline = "middle";
    sg.fillStyle = "#f5c518";
    sg.fillText("DJINN'S HOOD COURT", 512, 104);
    const signTex = new THREE.CanvasTexture(signC);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 2.5),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    sign.position.set(0, 8.6, -13.9);
    this.scene.add(sign);

    const woodMat = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.7 });
    const woodDark = new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.8 });

    // ---------- judge bench + Djinn Ra ----------
    const dais = new THREE.Mesh(new THREE.BoxGeometry(9, 1.1, 4), woodDark);
    dais.position.set(0, 0.55, -10.5);
    this.scene.add(dais);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(7, 1.7, 1.8), woodMat);
    bench.position.set(0, 1.95, -10.2);
    this.scene.add(bench);
    const benchTrim = new THREE.Mesh(
      new THREE.BoxGeometry(7.1, 0.18, 1.9),
      new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.35, metalness: 0.7 })
    );
    benchTrim.position.set(0, 2.85, -10.2);
    this.scene.add(benchTrim);

    // Djinn Ra billboard (cutout PNG)
    const texLoader = new THREE.TextureLoader();
    texLoader.load("djinnra-cutout.png", (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(3.4, 4.4);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      this.judgeMesh = new THREE.Mesh(geo, mat);
      this.judgeMesh.position.set(0, 4.6, -11.2);
      this.scene.add(this.judgeMesh);
    });
    const nameTag = makeLabel("JUDGE DJINN RA", { size: 40 });
    nameTag.position.set(0, 6.9, -11);
    this.scene.add(nameTag);

    // gavel on the bench
    this.gavel = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 1.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.6 })
    );
    handle.rotation.z = Math.PI / 2;
    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.35, metalness: 0.6 })
    );
    head.rotation.z = Math.PI / 2;
    head.position.x = 0.6;
    this.gavel.add(handle, head);
    this.gavel.position.set(2.2, 3.05, -10.2);
    this.scene.add(this.gavel);

    // flags beside the bench
    const flagC = document.createElement("canvas");
    flagC.width = 128; flagC.height = 192;
    const fg = flagC.getContext("2d");
    fg.fillStyle = "#0d0d0d"; fg.fillRect(0, 0, 128, 192);
    fg.fillStyle = "#f5c518"; fg.font = "900 84px serif";
    fg.textAlign = "center"; fg.fillText("⚖️", 64, 120);
    const flagTex = new THREE.CanvasTexture(flagC);
    flagTex.colorSpace = THREE.SRGBColorSpace;
    [-4.6, 4.6].forEach((x) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 6, 8),
        new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.7, roughness: 0.4 })
      );
      pole.position.set(x, 3, -12.5);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 2.4),
        new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide })
      );
      flag.position.set(x + 0.85, 4.6, -12.5);
      this.scene.add(pole, flag);
    });

    // ---------- counsel tables ----------
    this.anchors = {};
    const mkTable = (x, teamColor, label) => {
      const g = new THREE.Group();
      const desk = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.15, 1.7), woodMat);
      desk.position.y = 0.575;
      const topTrim = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 0.12, 1.8),
        new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.4 })
      );
      topTrim.position.y = 1.2;
      g.add(desk, topTrim);
      // two chairs
      [-1.1, 1.1].forEach((cx) => {
        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.8), woodDark);
        chair.position.set(cx, 0.55, 1.5);
        g.add(chair);
      });
      const tag = makeLabel(label, { size: 40, color: teamColor === PLAINTIFF_C ? "#f5c518" : "#4da3ff" });
      tag.position.y = 2.6;
      g.add(tag);
      g.position.set(x, 0, -2.5);
      this.scene.add(g);
      return new THREE.Vector3(x, 3.4, -2.5);
    };
    this.anchors.plaintiff = mkTable(-6.5, PLAINTIFF_C, "PLAINTIFF");
    this.anchors.defendant = mkTable(6.5, DEFENDANT_C, "DEFENDANT");

    // ---------- jury box (right side, 2 rows x 3) ----------
    const boxBase = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.9, 5.4), woodDark);
    boxBase.position.set(11.5, 0.45, -5);
    this.scene.add(boxBase);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 0.9, 0.18),
      new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.4, metalness: 0.6 })
    );
    rail.position.set(8.9, 1.3, -5);
    this.scene.add(rail);
    const juryTitle = makeLabel("THE JURY", { size: 44 });
    juryTitle.position.set(11.5, 4.6, -5);
    this.scene.add(juryTitle);

    this._jurors = [];
    this._jurorDefs = [];
    for (let i = 0; i < 6; i++) {
      const row = Math.floor(i / 3), col = i % 3;
      const fdef = JUROR_FACES[i];
      const jg = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.42, 0.9, 6, 14),
        new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 })
      );
      body.position.y = 1.35;
      // a real face instead of a blank pawn head
      const face = makeFace(fdef, 1.2);
      face.position.y = 2.42;
      jg.add(body, face);
      const badge = makeBadge("plaintiff");
      badge.position.y = 3.15;
      jg.add(badge);
      jg.position.set(10.2 + row * 2.4, 0.9, -7.2 + col * 2.2);
      jg.rotation.y = -Math.PI / 2.4;
      this.scene.add(jg);
      this._jurors.push({ group: jg, badge, body, face, persona: fdef.persona, hopT: -1, popT: -1, baseY: 0.9, nameTag: null,
        reactionAnchor: new THREE.Vector3(10.2 + row * 2.4, 5.0, -7.2 + col * 2.2) });
    }

    // ---------- plaintiff & defendant, third person at their tables ----------
    // They stand behind their counsel tables facing the judge — backs to the
    // camera like a real third-person shot, faces billboarded so you still
    // see who they are. Names update as players join; they hop when arguing.
    this._spawnContestants();

    // ---------- bubbles layer ----------
    this.bubbleLayer = document.getElementById("court-bubbles");

    this.clock = new THREE.Clock();
    this.ready = true;
    this._loop();
    window.addEventListener("resize", () => this.resize());
  },

  setJurorColors(colors) {
    // colors: array of 6 hex numbers matching the AI juror personas
    this._jurors.forEach((j, i) => {
      if (colors[i] !== undefined) j.body.material.color.setHex(colors[i]);
    });
  },

  _spawnContestants() {
    const defs = {
      plaintiff: { x: -6.5, color: PLAINTIFF_C, label: "PLAINTIFF" },
      defendant: { x: 6.5, color: DEFENDANT_C, label: "DEFENDANT" },
    };
    Object.keys(defs).forEach((team) => {
      const d = defs[team];
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.5, 1.05, 6, 14),
        new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.65 })
      );
      body.position.y = 1.45;
      const face = makeFace(CONTESTANT_FACES[team], 1.35);
      face.position.y = 2.6;
      const label = makeLabel(d.label, {
        size: 36,
        color: team === "plaintiff" ? "#f5c518" : "#4da3ff",
      });
      label.scale.set(3.0, 0.75, 1);
      label.position.y = 3.7;
      g.add(body, face, label);
      g.position.set(d.x, 0, -0.4); // camera side of the counsel table
      g.rotation.y = Math.PI;       // facing the judge — third person, back to camera
      this.scene.add(g);
      this._contestants[team] = { group: g, body, face, label, hopT: -1, name: d.label };
    });
  },

  setContestantName(team, name) {
    const c = this._contestants[team];
    if (!c) return;
    const shown = (name || team).toUpperCase().slice(0, 18);
    if (shown === c.name) return;
    c.name = shown;
    c.group.remove(c.label);
    const label = makeLabel(shown, {
      size: 36,
      color: team === "plaintiff" ? "#f5c518" : "#4da3ff",
    });
    label.scale.set(3.0, 0.75, 1);
    label.position.y = 3.7;
    c.label = label;
    c.group.add(label);
  },

  contestantSpeak(team) {
    const c = this._contestants[team];
    if (c) c.hopT = 0;
  },

  setJurorNames(names) {
    this._jurors.forEach((j, i) => {
      if (!names[i]) return;
      const shown = names[i].toUpperCase().slice(0, 22);
      if (j.nameTag) j.group.remove(j.nameTag);
      const tag = makeLabel(shown, { size: 34, color: "#ffe9c4" });
      tag.scale.set(2.6, 0.65, 1);
      tag.position.y = 2.95;
      j.nameTag = tag;
      j.group.add(tag);
    });
  },

  showJurorReaction(i, name, text) {
    // A juror blurts something out mid-trial — bubble over their head + hop.
    if (!this.bubbleLayer) return;
    const j = this._jurors[i];
    if (!j) return;
    j.hopT = 0;
    while (this._bubbles.length >= 6) {
      const old = this._bubbles.shift();
      old.el.remove();
    }
    const el = document.createElement("div");
    el.className = "cbubble jury";
    el.innerHTML = `<b></b><span></span>`;
    el.querySelector("b").textContent = name;
    el.querySelector("span").textContent = text;
    this.bubbleLayer.appendChild(el);
    this._bubbles.push({ el, anchor: j.reactionAnchor.clone(), born: performance.now(), life: 4500 });
  },

  setMode(mode) {
    // lobby | case | halftime | jury | verdict
    this._dimTarget = mode === "halftime" ? 0.32 : 1;
    this._juryFocus = mode === "jury";
    this._judgeFocus = mode === "verdict";
  },

  showArgument(team, name, text) {
    if (!this.bubbleLayer) return;
    while (this._bubbles.length >= 6) {
      const old = this._bubbles.shift();
      old.el.remove();
    }
    const el = document.createElement("div");
    el.className = "cbubble " + team;
    const short = text.length > 140 ? text.slice(0, 137) + "…" : text;
    el.innerHTML = `<b></b><span></span>`;
    el.querySelector("b").textContent = name;
    el.querySelector("span").textContent = short;
    this.bubbleLayer.appendChild(el);
    const anchor = this.anchors[team] || this.anchors.plaintiff;
    this._bubbles.push({ el, anchor: anchor.clone(), born: performance.now(), life: 7000 });
  },

  resetJury() {
    this._jurors.forEach((j) => {
      j.badge.visible = false;
      j.badge.scale.set(1, 1, 1);
      j.hopT = -1; j.popT = -1;
    });
  },

  revealJurorVote(i, vote) {
    const j = this._jurors[i];
    if (!j) return;
    // swap badge texture to the right team
    j.badge.material.map = makeBadge(vote).material.map;
    j.badge.visible = true;
    j.popT = 0;
    j.hopT = 0;
  },

  gavelBang() {
    this._gavelT = 0;
    this._shake = 0.55;
    const flash = document.getElementById("court-flash");
    if (flash) {
      flash.style.opacity = "0.55";
      setTimeout(() => (flash.style.opacity = "0"), 180);
    }
  },

  resize() {
    if (!this.ready) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  },

  _project(v3) {
    const v = v3.clone().project(this.camera);
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, behind: v.z > 1 };
  },

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    // judge idle bob
    if (this.judgeMesh) {
      this.judgeMesh.position.y = 4.6 + Math.sin(t * 1.4) * 0.08;
    }
    // juror idle sway — each juror moves like their personality
    this._jurors.forEach((j, i) => {
      const p = j.persona;
      if (p === "sway") j.group.rotation.z = Math.sin(t * 1.1 + i * 1.7) * 0.045;
      else if (p === "lean") j.group.rotation.z = Math.sin(t * 0.7 + i * 1.3) * 0.09;
      else if (p === "nod") j.face.position.y = 2.42 + Math.abs(Math.sin(t * 2.1 + i)) * 0.09 - 0.045;
      else if (p === "bob") j.face.position.y = 2.42 + Math.sin(t * 3.1 + i * 2) * 0.05;
      else if (p === "bounce") j.group.position.y = j.baseY + Math.abs(Math.sin(t * 2.6 + i * 2)) * 0.1;
      else if (p === "shake") j.face.position.x = Math.sin(t * 4.6 + i) * 0.055;
      if (j.hopT >= 0) {
        j.hopT += dt * 2.4;
        const k = j.hopT;
        j.group.position.y = j.baseY + (k < 1 ? Math.sin(k * Math.PI) * 0.55 : 0);
        if (k >= 1) { j.hopT = -1; j.group.position.y = j.baseY; }
      }
      if (j.popT >= 0) {
        j.popT += dt * 3;
        const k = Math.min(j.popT, 1);
        const s = 1 + Math.sin(k * Math.PI) * 0.6;
        j.badge.scale.set(s, s, 1);
        if (k >= 1) j.popT = -1;
      }
    });
    // contestants: subtle idle bob, hop when their side argues
    Object.values(this._contestants).forEach((c, k) => {
      if (c.hopT >= 0) {
        c.hopT += dt * 2.2;
        const hk = c.hopT;
        c.group.position.y = hk < 1 ? Math.sin(hk * Math.PI) * 0.5 : 0;
        if (hk >= 1) { c.hopT = -1; c.group.position.y = 0; }
      } else {
        c.group.position.y = Math.sin(t * 1.4 + k * 2.4) * 0.045;
        c.face.position.y = 2.6 + Math.sin(t * 1.9 + k * 1.8) * 0.03;
      }
    });
    // gavel slam
    if (this._gavelT >= 0) {
      this._gavelT += dt * 3.2;
      const k = this._gavelT;
      if (k < 1) {
        this.gavel.rotation.z = -Math.abs(Math.sin(k * Math.PI * 2)) * 0.9;
      } else {
        this.gavel.rotation.z = 0;
        this._gavelT = -1;
      }
    }
    // camera: sway + shake
    this._shake = Math.max(0, this._shake - dt * 1.4);
    const sh = this._shake * this._shake;
    this.camera.position.set(
      this.cameraBase.x + Math.sin(t * 0.24) * 0.35 + (Math.random() - 0.5) * sh * 1.6,
      this.cameraBase.y + Math.sin(t * 0.31) * 0.18 + (Math.random() - 0.5) * sh * 1.2,
      this.cameraBase.z
    );
    this.camera.lookAt(0, 1.8, -5);

    // lighting mood
    const dimK = 0.12;
    const cur = this.ambient.intensity / 0.55;
    const next = cur + (this._dimTarget - cur) * Math.min(1, dt * 3);
    const applyDim = (light, base) => { light.intensity = base * (0.25 + 0.75 * next); };
    applyDim(this.ambient, 0.55);
    applyDim(this.key, 900);
    applyDim(this.goldGlow, 60);
    this.judgeSpot.intensity = 700 * (0.25 + 0.75 * next) * (this._judgeFocus ? 1.8 : 1);
    this.jurySpot.intensity = 250 * (0.25 + 0.75 * next) * (this._juryFocus ? 2.4 : 1);

    // bubbles
    const now = performance.now();
    this._bubbles = this._bubbles.filter((b) => {
      const age = now - b.born;
      if (age > b.life) { b.el.remove(); return false; }
      const p = this._project(b.anchor);
      if (p.behind) { b.el.style.display = "none"; }
      else {
        b.el.style.display = "block";
        b.el.style.transform = `translate(-50%, -100%) translate(${p.x}px, ${p.y}px)`;
        b.el.style.opacity = age > b.life - 1200 ? String((b.life - age) / 1200) : "1";
      }
      return true;
    });

    this.renderer.render(this.scene, this.camera);
  },
};

window.Courtroom3D = Courtroom3D;
export { Courtroom3D };
