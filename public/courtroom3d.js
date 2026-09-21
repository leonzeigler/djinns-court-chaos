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

const Courtroom3D = {
  ready: false,
  _bubbles: [],
  _jurors: [],
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
      const jg = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.42, 0.9, 6, 14),
        new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 })
      );
      body.position.y = 1.35;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 18, 14),
        new THREE.MeshStandardMaterial({ color: 0xc9a186, roughness: 0.6 })
      );
      head.position.y = 2.35;
      jg.add(body, head);
      const badge = makeBadge("plaintiff");
      badge.position.y = 3.15;
      jg.add(badge);
      jg.position.set(10.2 + row * 2.4, 0.9, -7.2 + col * 2.2);
      jg.rotation.y = -Math.PI / 2.4;
      this.scene.add(jg);
      this._jurors.push({ group: jg, badge, body, hopT: -1, popT: -1, baseY: 0.9 });
    }

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

  setJurorNames(names) {
    this._jurors.forEach((j, i) => {
      if (!names[i]) return;
      const tag = makeLabel(names[i].toUpperCase(), { size: 34, color: "#ffe9c4" });
      tag.scale.set(2.6, 0.65, 1);
      tag.position.y = 2.85;
      j.group.add(tag);
    });
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
    // juror idle sway
    this._jurors.forEach((j, i) => {
      j.group.rotation.z = Math.sin(t * 1.1 + i * 1.7) * 0.03;
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
