// The Living Room: a small dog wanders around, hops on furniture, and farts when you click.
// When the room fills up with gas, a window opens or a giant vacuum shows up to clear it.
(() => {
  const canvas = document.getElementById("dog-scene");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = 800, H = 450;

  const meter = document.getElementById("dog-meter");
  const meterFill = document.getElementById("dog-meter-fill");
  const meterText = document.getElementById("dog-meter-text");
  const said = document.getElementById("dog-said");
  const muteBtn = document.getElementById("dog-mute");
  const tootBtn = document.getElementById("dog-toot");
  const countEl = document.getElementById("dog-count");

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || W;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((w * dpr * H) / W);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- Surfaces the dog can stand on ----------
  const FLOOR = { name: "floor", x0: 30, x1: 770, y: 418 };
  const SURFACES = [
    FLOOR,
    { name: "ottoman", x0: 120, x1: 180, y: 372 },
    { name: "seat", x0: 290, x1: 490, y: 332 },
    { name: "back", x0: 296, x1: 484, y: 256 },
    { name: "cabinet", x0: 610, x1: 690, y: 342 },
    { name: "sill", x0: 596, x1: 704, y: 230 },
  ];

  // ---------- State ----------
  const dog = {
    x: 420, y: FLOOR.y, dir: 1, surf: FLOOR, mode: "walk", target: 520,
    phase: 0, hop: 0, hopV: 0, pauseUntil: 0, zoomUntil: 0,
    expr: "normal", exprUntil: 0, bubble: null, plan: null, jump: null, moving: false,
  };
  let puffs = [];
  let texts = [];
  let gas = 0;
  let cleanup = null;
  let lastCleanupType = null;
  let aired = 0;
  let lastReaction = null;
  let lastT = performance.now();

  function say(text, ms) {
    dog.bubble = { text, until: performance.now() + (ms || 2600) };
    if (said) said.textContent = text;
  }
  say("Click anywhere. I dare you.", 4500);

  function updateMeter() {
    const p = Math.round(clamp(gas, 0, 100));
    if (meterFill) meterFill.style.width = p + "%";
    if (meterText) meterText.textContent = p + "%";
    if (meter) meter.setAttribute("aria-valuenow", String(p));
  }

  // ---------- Sound (synthesized, no files) ----------
  let actx = null;
  let muted = false;
  function audio() {
    if (muted) return null;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
    } catch (e) {
      return null;
    }
    return actx;
  }

  function noiseBuffer(a, dur) {
    const b = a.createBuffer(1, Math.max(1, Math.ceil(a.sampleRate * dur)), a.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function playFart(kind) {
    const a = audio();
    if (!a) return;
    const t0 = a.currentTime;
    const dur = kind.dur * rand(0.8, 1.2);
    const vol = kind.vol == null ? 0.32 : kind.vol;
    const f = kind.f * rand(0.85, 1.15);

    const osc = a.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f, t0);
    osc.frequency.linearRampToValueAtTime(f * kind.bend, t0 + dur);
    const lfo = a.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = kind.rate * rand(0.8, 1.2);
    const lfoGain = a.createGain();
    lfoGain.gain.value = f * 0.35;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const filter = a.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = kind.cut;
    filter.Q.value = 4;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.setValueAtTime(vol * 0.85, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filter);
    filter.connect(g);
    g.connect(a.destination);

    const ns = a.createBufferSource();
    ns.buffer = noiseBuffer(a, dur);
    const nf = a.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = kind.cut * 0.6;
    nf.Q.value = 1.2;
    const ng = a.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 0.4), t0 + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    ns.connect(nf);
    nf.connect(ng);
    ng.connect(a.destination);

    osc.start(t0); lfo.start(t0); ns.start(t0);
    osc.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05); ns.stop(t0 + dur + 0.05);
  }

  function playWhoosh(dur) {
    const a = audio();
    if (!a) return;
    const t0 = a.currentTime;
    const ns = a.createBufferSource();
    ns.buffer = noiseBuffer(a, dur);
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(300, t0);
    f.frequency.linearRampToValueAtTime(1200, t0 + dur * 0.5);
    f.frequency.linearRampToValueAtTime(400, t0 + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.15, t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    ns.connect(f); f.connect(g); g.connect(a.destination);
    ns.start(t0); ns.stop(t0 + dur);
  }

  let hum = null;
  function startHum() {
    const a = audio();
    if (!a || hum) return;
    const t0 = a.currentTime;
    const osc = a.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 118;
    const ns = a.createBufferSource();
    ns.buffer = noiseBuffer(a, 1);
    ns.loop = true;
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.4);
    osc.connect(f); ns.connect(f); f.connect(g); g.connect(a.destination);
    osc.start(t0); ns.start(t0);
    hum = { osc, ns, g, a };
  }
  function stopHum() {
    if (!hum) return;
    const { osc, ns, g, a } = hum;
    const t0 = a.currentTime;
    try {
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(g.gain.value || 0.05, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      osc.stop(t0 + 0.45);
      ns.stop(t0 + 0.45);
    } catch (e) {}
    hum = null;
  }

  // ---------- Farts ----------
  const KINDS = [
    { label: "pfft", dur: 0.22, f: 150, bend: 0.8, rate: 40, cut: 700, puffs: 2, gas: 7 },
    { label: "BRRRAP!", dur: 0.8, f: 90, bend: 0.7, rate: 22, cut: 600, puffs: 5, gas: 13 },
    { label: "squeeeak", dur: 0.55, f: 300, bend: 1.3, rate: 30, cut: 1400, puffs: 3, gas: 9 },
    { label: "thrrrrrp", dur: 1.1, f: 70, bend: 0.6, rate: 16, cut: 450, puffs: 6, gas: 15 },
    { label: "toot!", dur: 0.3, f: 230, bend: 1.0, rate: 50, cut: 1000, puffs: 2, gas: 8 },
    { label: "…(silent)", dur: 0.5, f: 60, bend: 0.9, rate: 12, cut: 200, puffs: 8, gas: 19, vol: 0.03 },
  ];

  const REACTIONS = [
    { id: "startled", text: ["Whoa! Was that ME?!", "AAH! What was that?!"], expr: "startled" },
    { id: "satisfied", text: ["Ahh… much better.", "That one had been brewing."], expr: "satisfied" },
    { id: "proud", text: ["Nailed it. 😎", "10/10, would toot again."], expr: "satisfied" },
    { id: "sniff", text: ["*sniff sniff* …oh no.", "*sniff* Hm. Vintage."], expr: "normal" },
    { id: "embarrassed", text: ["Wasn't me. It was the couch.", "Please don't look at me."], expr: "embarrassed" },
    { id: "zoom", text: ["RUN FROM IT!", "Nope nope nope!"], expr: "startled" },
    { id: "look", text: ["Did you hear something?", "…anyway."], expr: "normal" },
  ];
  const GAG = { id: "gag", text: ["Even I think it's bad in here.", "Someone open a window!"], expr: "embarrassed" };

  function fart() {
    const now = performance.now();
    if (cleanup) {
      say(pick(["*holding it in*", "Not while they're cleaning!", "…I'll save it for later."]), 1600);
      return;
    }
    const kind = pick(KINDS);
    playFart(kind);

    const rx = dog.x - dog.dir * 26;
    const ry = dog.y - dog.hop - 20;
    for (let i = 0; i < kind.puffs; i++) {
      puffs.push({
        x: rx + rand(-6, 6), y: ry + rand(-6, 6),
        vx: -dog.dir * rand(20, 70) + rand(-15, 15), vy: rand(-40, -5),
        r: rand(8, 14), rMax: rand(45, 95), a: rand(0.28, 0.42),
        hue: rand(70, 95), seed: Math.random() * 1000,
      });
    }
    if (puffs.length > 140) puffs.splice(0, puffs.length - 140);
    texts.push({ text: kind.label, x: rx - dog.dir * 10, y: ry - 6, vy: -40, born: now, life: 1200 });

    gas = Math.min(100, gas + kind.gas * rand(0.85, 1.15));
    updateMeter();

    // Reaction
    const pool = REACTIONS.filter((r) => r.id !== lastReaction);
    if (gas > 60) pool.push(GAG, GAG);
    const r = pick(pool);
    lastReaction = r.id;
    dog.expr = r.expr;
    dog.exprUntil = now + 1700;
    say(pick(r.text), 2400);

    if (dog.mode === "walk") {
      switch (r.id) {
        case "startled": dog.hopV = 300; dog.pauseUntil = now + 800; break;
        case "satisfied": dog.pauseUntil = now + 1500; break;
        case "proud": dog.pauseUntil = now + 1100; break;
        case "sniff": dog.dir = -dog.dir; dog.pauseUntil = now + 1400; dog.sniffing = true; break;
        case "embarrassed": case "gag": case "look": dog.pauseUntil = now + 1000; break;
        case "zoom": zoomAway(now); break;
      }
    } else if (r.id === "startled") {
      dog.expr = "startled";
    }

    if (gas >= 100) setTimeout(startCleanup, 700);
  }

  function zoomAway(now, dirOverride) {
    const d = dirOverride || dog.dir;
    dog.plan = null;
    dog.pauseUntil = 0;
    dog.target = d > 0 ? dog.surf.x1 - 4 : dog.surf.x0 + 4;
    dog.zoomUntil = now + 1600;
  }

  // ---------- Dog movement ----------
  function decide(now) {
    const r = Math.random();
    if (r < 0.18) {
      dog.pauseUntil = now + rand(600, 1800);
      dog.target = dog.x;
      return;
    }
    if (r < 0.6) {
      const cur = dog.surf;
      const options = [];
      for (const s of SURFACES) {
        if (s === cur || Math.abs(s.y - cur.y) > 120) continue;
        const landing = clamp(dog.x + rand(-50, 50), s.x0 + 8, s.x1 - 8);
        let sign = Math.sign(landing - dog.x) || (Math.random() < 0.5 ? -1 : 1);
        const takeoff = clamp(landing - sign * rand(40, 80), cur.x0 + 6, cur.x1 - 6);
        if (Math.abs(landing - takeoff) > 200) continue;
        options.push({ surf: s, landing, takeoff });
      }
      if (options.length) {
        const o = pick(options);
        dog.plan = o;
        dog.target = o.takeoff;
        return;
      }
    }
    const s = dog.surf;
    let t = rand(s.x0 + 6, s.x1 - 6);
    if (Math.abs(t - dog.x) < 40) t = clamp(dog.x + (Math.random() < 0.5 ? -1 : 1) * rand(60, 200), s.x0 + 6, s.x1 - 6);
    dog.target = t;
  }

  function startJump() {
    const p = dog.plan;
    const x0 = dog.x, y0 = dog.y, x1 = p.landing, y1 = p.surf.y;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    dog.jump = { x0, y0, x1, y1, t: 0, dur: 0.45 + dist / 450, h: Math.abs(y0 - y1) / 2 + 34, to: p.surf };
    if (x1 !== x0) dog.dir = Math.sign(x1 - x0);
    dog.mode = "jump";
    dog.plan = null;
  }

  function updateDog(dt, now) {
    // reaction hop
    if (dog.hop > 0 || dog.hopV > 0) {
      dog.hop += dog.hopV * dt;
      dog.hopV -= 1100 * dt;
      if (dog.hop <= 0) { dog.hop = 0; dog.hopV = 0; }
    }
    if (now > dog.exprUntil) dog.expr = "normal";

    if (dog.mode === "jump") {
      const j = dog.jump;
      j.t += dt / j.dur;
      const t = Math.min(1, j.t);
      dog.x = j.x0 + (j.x1 - j.x0) * t;
      dog.y = j.y0 + (j.y1 - j.y0) * t - j.h * 4 * t * (1 - t);
      dog.moving = false;
      if (t >= 1) {
        dog.mode = "walk";
        dog.surf = j.to;
        dog.y = j.to.y;
        dog.jump = null;
        dog.pauseUntil = now + rand(150, 500);
        decide(now);
      }
      return;
    }

    if (now < dog.pauseUntil) {
      dog.moving = false;
      return;
    }
    dog.sniffing = false;
    const speed = now < dog.zoomUntil ? 240 : 70;
    const dx = dog.target - dog.x;
    if (Math.abs(dx) < 2) {
      dog.x = dog.target;
      dog.moving = false;
      if (dog.plan) startJump();
      else decide(now);
      return;
    }
    dog.dir = Math.sign(dx);
    dog.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    dog.moving = true;
    dog.phase += dt * speed * 0.22;
  }

  // ---------- Gas ----------
  function updatePuffs(dt, now) {
    for (const p of puffs) {
      p.vx *= 1 - 0.9 * dt;
      p.vy *= 1 - 0.9 * dt;
      p.vx += Math.sin(now / 900 + p.seed) * 6 * dt;
      p.vy += Math.cos(now / 1100 + p.seed) * 5 * dt - 2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.r < p.rMax) p.r += (p.rMax - p.r) * 0.35 * dt;
      // soft walls
      if (p.x < 0) p.vx += 30 * dt;
      if (p.x > W) p.vx -= 30 * dt;
      if (p.y < 0) p.vy += 30 * dt;
      if (p.y > H) p.vy -= 30 * dt;
    }
  }

  function suckToward(tx, ty, dt, force) {
    for (const p of puffs) {
      const dx = tx - p.x, dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      p.vx += (dx / d) * force * dt;
      p.vy += (dy / d) * force * dt;
      p.vx *= 1 - 1.5 * dt;
      p.vy *= 1 - 1.5 * dt;
      if (d < 60) { p.a -= dt * 1.8; p.r *= 1 - 1.5 * dt; }
      p.a -= dt * 0.06;
    }
    puffs = puffs.filter((p) => p.a > 0.01 && p.r > 2);
  }

  // ---------- Cleanup ----------
  function startCleanup() {
    if (cleanup || gas < 100) return;
    let type = Math.random() < 0.5 ? "window" : "vacuum";
    if (type === lastCleanupType && Math.random() < 0.75) type = type === "window" ? "vacuum" : "window";
    lastCleanupType = type;
    cleanup = { type, start: performance.now(), gas0: gas, stage: 0 };
    if (type === "window") {
      say("Phew! Somebody's opening the window…", 2500);
      playWhoosh(2.4);
    } else {
      say("Uh oh. Is that… THE VACUUM?!", 2200);
    }
  }

  function finishCleanup() {
    stopHum();
    cleanup = null;
    puffs = [];
    gas = 0;
    aired++;
    if (countEl) countEl.textContent = aired;
    updateMeter();
    say(pick(["Fresh air! Let's go again.", "Ahh, clean slate.", "Okay. Round two?"]), 2600);
  }

  function updateCleanup(dt, now) {
    if (!cleanup) return;
    const c = cleanup;
    const el = now - c.start;
    if (c.type === "window") {
      c.open = el < 800 ? ease(el / 800) : el < 4200 ? 1 : el < 5000 ? 1 - ease((el - 4200) / 800) : 0;
      if (el > 800 && el < 4200) {
        suckToward(650, 150, dt, 260);
        gas = c.gas0 * (1 - clamp((el - 800) / 3400, 0, 1));
        updateMeter();
      }
      if (el >= 5000) finishCleanup();
    } else {
      let vx;
      if (el < 1400) vx = 940 - 330 * ease(el / 1400);
      else if (el < 4400) vx = 610 + Math.sin(el / 120) * 3;
      else vx = 610 + 360 * ease(clamp((el - 4400) / 1400, 0, 1));
      c.vx = vx;
      c.sucking = el > 1400 && el < 4400;
      if (c.stage === 0 && el > 900) {
        c.stage = 1;
        if (dog.mode === "walk") {
          dog.expr = "startled";
          dog.exprUntil = now + 3000;
          zoomAway(now, -1);
        }
        say("AAAH! THE VACUUM!", 2200);
      }
      if (c.sucking) {
        if (c.stage === 1) { c.stage = 2; startHum(); }
        suckToward(vx - 112, 400, dt, 340);
        gas = c.gas0 * (1 - clamp((el - 1400) / 3000, 0, 1));
        updateMeter();
      } else if (c.stage === 2) {
        c.stage = 3;
        stopHum();
      }
      if (el >= 5800) finishCleanup();
    }
  }

  // ---------- Drawing helpers ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function ellipse(x, y, rx, ry, color, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ---------- Scene ----------
  function drawRoom(now) {
    // Wall
    ctx.fillStyle = "#f3e3c3";
    ctx.fillRect(0, 0, W, 362);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    for (let x = 0; x < W; x += 44) ctx.fillRect(x, 0, 20, 352);
    // Baseboard
    ctx.fillStyle = "#fffaf0";
    ctx.fillRect(0, 350, W, 12);
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 360, W, 2);
    // Floor
    ctx.fillStyle = "#c58f5a";
    ctx.fillRect(0, 362, W, H - 362);
    ctx.strokeStyle = "rgba(90,50,20,0.25)";
    ctx.lineWidth = 1.5;
    for (let y = 384; y < H; y += 22) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let row = 0; row < 5; row++) {
      const y = 362 + row * 22;
      for (let x = (row % 2) * 70; x < W; x += 140) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 22); ctx.stroke();
      }
    }
    // Rug
    ellipse(400, 414, 210, 24, "#7d4f96");
    ellipse(400, 414, 190, 18, "#9b6cb4");
    ellipse(400, 414, 120, 10, "#b98fd0");

    drawWindow(now);

    // Painting over the couch
    ctx.fillStyle = "#6b4423";
    ctx.fillRect(330, 112, 140, 92);
    ctx.fillStyle = "#bfe3f5";
    ctx.fillRect(338, 120, 124, 76);
    ellipse(440, 136, 10, 10, "#ffd34d");
    ellipse(370, 200, 60, 32, "#7bc06a");
    ellipse(440, 205, 55, 30, "#5ea653");
    // a little bone on the hill, because dogs
    ctx.fillStyle = "#fff";
    ctx.fillRect(388, 172, 18, 5);
    ellipse(388, 172, 3.5, 3.5, "#fff"); ellipse(388, 177, 3.5, 3.5, "#fff");
    ellipse(406, 172, 3.5, 3.5, "#fff"); ellipse(406, 177, 3.5, 3.5, "#fff");

    // Clock (shows real time)
    ellipse(190, 100, 30, 30, "#3b2a1a");
    ellipse(190, 100, 25, 25, "#fffdf6");
    const d = new Date();
    const hA = ((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2;
    const mA = (d.getMinutes() + d.getSeconds() / 60) / 60 * Math.PI * 2;
    const sA = (d.getSeconds() + d.getMilliseconds() / 1000) / 60 * Math.PI * 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(190, 100); ctx.lineTo(190 + Math.sin(hA) * 12, 100 - Math.cos(hA) * 12); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(190, 100); ctx.lineTo(190 + Math.sin(mA) * 19, 100 - Math.cos(mA) * 19); ctx.stroke();
    ctx.strokeStyle = "#c33"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(190, 100); ctx.lineTo(190 + Math.sin(sA) * 20, 100 - Math.cos(sA) * 20); ctx.stroke();

    // Floor lamp
    ctx.fillStyle = "#333";
    ctx.fillRect(58, 200, 5, 214);
    ellipse(60, 416, 22, 5, "#333");
    ctx.fillStyle = "#ffe29a";
    ctx.beginPath();
    ctx.moveTo(38, 205); ctx.lineTo(82, 205); ctx.lineTo(72, 165); ctx.lineTo(48, 165); ctx.closePath();
    ctx.fill();
    const glow = ctx.createRadialGradient(60, 210, 5, 60, 210, 90);
    glow.addColorStop(0, "rgba(255,230,150,0.35)");
    glow.addColorStop(1, "rgba(255,230,150,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 120, 160, 200);

    // Ottoman
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(118, 398, 6, 20); ctx.fillRect(176, 398, 6, 20);
    rr(110, 372, 80, 30, 8); ctx.fillStyle = "#d1603d"; ctx.fill();
    rr(110, 372, 80, 9, 6); ctx.fillStyle = "#e57a56"; ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ellipse(130, 389, 2, 2, "rgba(0,0,0,0.2)"); ellipse(150, 389, 2, 2, "rgba(0,0,0,0.2)"); ellipse(170, 389, 2, 2, "rgba(0,0,0,0.2)");

    // Couch
    ctx.fillStyle = "#3e2a1a";
    ctx.fillRect(268, 402, 8, 16); ctx.fillRect(504, 402, 8, 16);
    rr(278, 256, 224, 84, 16); ctx.fillStyle = "#3f7f8c"; ctx.fill(); // back
    ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(390, 264); ctx.lineTo(390, 332); ctx.stroke();
    rr(276, 332, 228, 46, 10); ctx.fillStyle = "#4b95a3"; ctx.fill(); // seat
    ctx.beginPath(); ctx.moveTo(390, 336); ctx.lineTo(390, 374); ctx.stroke();
    rr(270, 372, 240, 32, 8); ctx.fillStyle = "#336b76"; ctx.fill(); // base
    rr(250, 300, 36, 104, 14); ctx.fillStyle = "#3a7682"; ctx.fill(); // arms
    rr(494, 300, 36, 104, 14); ctx.fill();
    // a throw pillow
    ctx.save(); ctx.translate(470, 318); ctx.rotate(-0.25);
    rr(-16, -14, 32, 28, 8); ctx.fillStyle = "#ffb02e"; ctx.fill();
    ctx.restore();

    // Cabinet under the window
    rr(600, 342, 100, 70, 4); ctx.fillStyle = "#8a5a35"; ctx.fill();
    ctx.fillStyle = "#6f4426";
    ctx.fillRect(600, 342, 100, 6);
    ctx.strokeStyle = "#5c381e"; ctx.lineWidth = 2;
    ctx.strokeRect(608, 356, 84, 22); ctx.strokeRect(608, 384, 84, 22);
    ellipse(650, 367, 3, 3, "#e8c26a"); ellipse(650, 395, 3, 3, "#e8c26a");
    ctx.fillStyle = "#5c381e"; ctx.fillRect(604, 412, 6, 6); ctx.fillRect(690, 412, 6, 6);

    // Potted plant
    ctx.fillStyle = "#b5562f";
    ctx.beginPath(); ctx.moveTo(728, 380); ctx.lineTo(768, 380); ctx.lineTo(762, 418); ctx.lineTo(734, 418); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.38 + Math.sin(now / 1500 + i) * 0.04;
      ellipse(748 + Math.cos(a) * 26, 376 + Math.sin(a) * 30, 7, 20, i % 2 ? "#3f8f4a" : "#56a85e", a + Math.PI / 2);
    }
  }

  function drawWindow(now) {
    const open = cleanup && cleanup.type === "window" ? cleanup.open || 0 : 0;
    // Frame + sky
    ctx.fillStyle = "#fffaf0";
    ctx.fillRect(585, 68, 130, 162);
    const sky = ctx.createLinearGradient(0, 78, 0, 226);
    sky.addColorStop(0, "#8fd0f7");
    sky.addColorStop(1, "#d9f1ff");
    ctx.fillStyle = sky;
    ctx.fillRect(595, 78, 110, 148);
    ellipse(625, 200, 30, 26, "#6fb35f");
    ellipse(675, 210, 36, 24, "#5ea653");
    ellipse(640 + Math.sin(now / 4000) * 20, 100, 16, 7, "rgba(255,255,255,0.9)");
    ellipse(655 + Math.sin(now / 4000) * 20, 97, 12, 6, "rgba(255,255,255,0.9)");
    // Upper sash
    ctx.strokeStyle = "#fffaf0"; ctx.lineWidth = 6;
    ctx.strokeRect(595, 78, 110, 74);
    ctx.beginPath(); ctx.moveTo(650, 78); ctx.lineTo(650, 152); ctx.stroke();
    // Lower sash (slides up when opening)
    const ly = 152 - open * 66;
    ctx.fillStyle = "rgba(210,235,255,0.35)";
    ctx.fillRect(595, ly, 110, 74);
    ctx.strokeRect(595, ly, 110, 74);
    ctx.beginPath(); ctx.moveTo(650, ly); ctx.lineTo(650, ly + 74); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(604, ly + 60); ctx.lineTo(620, ly + 12); ctx.stroke();
    // Sill
    ctx.fillStyle = "#efe6d4";
    ctx.fillRect(578, 228, 144, 12);
    // Curtains (flutter when open)
    const fl = open * 14;
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.moveTo(566, 58); ctx.lineTo(600, 58);
    ctx.quadraticCurveTo(592 + Math.sin(now / 160) * fl, 150, 596 + Math.sin(now / 130) * fl * 1.4, 250);
    ctx.lineTo(566 + Math.sin(now / 150) * fl * 0.5, 250);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(700, 58); ctx.lineTo(734, 58);
    ctx.lineTo(734 + Math.sin(now / 150 + 1) * fl * 0.5, 250);
    ctx.lineTo(704 + Math.sin(now / 130 + 1) * fl * 1.4, 250);
    ctx.quadraticCurveTo(708 + Math.sin(now / 160 + 1) * fl, 150, 700, 58);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#6b4423";
    ctx.fillRect(556, 52, 188, 7);
  }

  function drawVacuum(now) {
    if (!cleanup || cleanup.type !== "vacuum" || cleanup.vx == null) return;
    const x = cleanup.vx;
    const shake = cleanup.sucking ? Math.sin(now / 30) * 1.2 : 0;
    // hose
    ctx.strokeStyle = "#444"; ctx.lineWidth = 9; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 6, 330);
    ctx.bezierCurveTo(x - 40, 300, x - 60, 330, x - 70, 345);
    ctx.stroke();
    // wand
    ctx.strokeStyle = "#b0b6bf"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x - 70, 345); ctx.lineTo(x - 108, 404); ctx.stroke();
    // nozzle
    rr(x - 140, 400, 66, 16, 5); ctx.fillStyle = "#2b2b2b"; ctx.fill();
    // body
    rr(x, 290 + shake, 120, 112, 26); ctx.fillStyle = "#e0412f"; ctx.fill();
    rr(x + 10, 300 + shake, 100, 30, 14); ctx.fillStyle = "#ff6a52"; ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("SUCK-O-MATIC", x + 60, 360 + shake);
    ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("9000", x + 60, 377 + shake);
    // wheels
    ellipse(x + 26, 406, 12, 12, "#222"); ellipse(x + 94, 406, 12, 12, "#222");
    ellipse(x + 26, 406, 4, 4, "#888"); ellipse(x + 94, 406, 4, 4, "#888");
    // suction swirls
    if (cleanup.sucking) {
      ctx.strokeStyle = "rgba(140,170,60,0.6)"; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const p = ((now / 400 + i / 4) % 1);
        const r = 60 * (1 - p);
        ctx.beginPath();
        ctx.arc(x - 107, 400, r, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      }
    }
  }

  function drawWind(now) {
    if (!cleanup || cleanup.type !== "window" || !(cleanup.open > 0.6)) return;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const p = ((now / 900 + i / 9) % 1);
      const sx = 80 + ((i * 97) % 480), sy = 120 + ((i * 53) % 220);
      const x = sx + (650 - sx) * p, y = sy + (160 - sy) * p;
      ctx.globalAlpha = Math.sin(p * Math.PI);
      ctx.beginPath();
      ctx.moveTo(x - 28, y + Math.sin(now / 200 + i) * 4);
      ctx.quadraticCurveTo(x - 12, y - 6, x, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawDog(now) {
    const d = dog;
    // shadow
    if (d.mode !== "jump") ellipse(d.x, d.y + 1, 26 - d.hop * 0.1, 4, "rgba(0,0,0,0.18)");
    ctx.save();
    ctx.translate(d.x, d.y - d.hop);
    ctx.scale(d.dir, 1);
    const ph = d.phase;
    const fur = "#b5713a", dark = "#6b3d1a", light = "#e2b07a";

    // tail
    const wag = Math.sin(now / (d.expr === "satisfied" ? 70 : 120)) * 7;
    ctx.strokeStyle = fur; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-21, -24); ctx.quadraticCurveTo(-32, -30, -34 + wag * 0.3, -40 + wag); ctx.stroke();

    // legs
    ctx.strokeStyle = "#9a5d2e"; ctx.lineWidth = 5;
    const legs = [[-15, 0], [-9, Math.PI], [11, Math.PI], [17, 0]];
    for (const [lx, off] of legs) {
      const sw = d.moving ? Math.sin(ph + off) * 6 : 0;
      const len = d.mode === "jump" ? 6 : 11;
      const kick = d.mode === "jump" ? (lx < 0 ? -5 : 5) : 0;
      ctx.beginPath(); ctx.moveTo(lx, -13); ctx.lineTo(lx + sw + kick, -13 + len); ctx.stroke();
    }

    // body
    ellipse(0, -21, 24, 11, fur);
    ellipse(2, -16, 16, 5, light);
    // collar
    ctx.strokeStyle = "#d33"; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(15, -32); ctx.lineTo(19, -22); ctx.stroke();
    ellipse(19, -20, 2.5, 2.5, "#ffd34d");

    // head (sniffing lowers it)
    const hy = d.sniffing ? 6 : 0;
    ellipse(25, -33 + hy, 11, 10, fur);
    ellipse(34, -29 + hy, 8, 6, light);
    ellipse(41, -31 + hy, 2.8, 2.4, "#111");
    ellipse(19, -32 + hy, 4.5, 10, dark, 0.35);

    // face by expression
    const ex = 28, ey = -36 + hy;
    if (d.expr === "startled") {
      ellipse(ex, ey, 4, 4, "#fff");
      ellipse(ex + 0.8, ey, 1.8, 1.8, "#111");
      ellipse(35, -25 + hy, 2.2, 2.6, "#5a1d1d");
    } else if (d.expr === "satisfied") {
      ctx.strokeStyle = "#111"; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(ex, ey + 1, 2.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(34, -27 + hy, 4, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    } else if (d.expr === "embarrassed") {
      ellipse(ex, ey, 1.8, 1.8, "#111");
      ellipse(29, -29 + hy, 4, 2.5, "rgba(255,110,140,0.75)");
    } else {
      ellipse(ex, ey, 2, 2.2, "#111");
      ellipse(ex + 0.7, ey - 0.8, 0.7, 0.7, "#fff");
    }
    ctx.restore();

    if (d.expr === "startled") {
      ctx.fillStyle = "#d33";
      ctx.font = "bold 26px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("!", d.x + d.dir * 30, d.y - d.hop - 52);
    }
  }

  function drawFlies(now) {
    if (gas < 40) return;
    const n = 1 + Math.floor((gas - 40) / 22);
    for (let i = 0; i < n; i++) {
      const t = now / 1000 * (2 + i * 0.4) + i * 2;
      const fx = dog.x + Math.cos(t) * (26 + i * 6) + Math.sin(t * 3.1) * 4;
      const fy = dog.y - dog.hop - 52 + Math.sin(t * 1.7) * 12;
      const flap = Math.sin(now / 18 + i) * 2;
      ellipse(fx - 2, fy - 3, 2.6, 1.6 + flap * 0.3, "rgba(255,255,255,0.8)", -0.5);
      ellipse(fx + 2, fy - 3, 2.6, 1.6 - flap * 0.3, "rgba(255,255,255,0.8)", 0.5);
      ellipse(fx, fy, 2.2, 1.8, "#111");
    }
  }

  function drawGas(now) {
    for (const p of puffs) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `hsla(${p.hue}, 55%, 52%, ${p.a})`);
      g.addColorStop(0.6, `hsla(${p.hue}, 50%, 55%, ${p.a * 0.55})`);
      g.addColorStop(1, `hsla(${p.hue}, 50%, 55%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    const f = clamp(gas / 100, 0, 1);
    if (f > 0) {
      ctx.fillStyle = `rgba(150, 175, 50, ${f * 0.5})`;
      ctx.fillRect(0, 0, W, H);
      // wavy stink lines once it gets bad
      if (f > 0.5) {
        ctx.strokeStyle = `rgba(90, 120, 20, ${(f - 0.5) * 0.9})`;
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 6; i++) {
          const bx = 60 + i * 130, rise = (now / 30 + i * 40) % 120;
          ctx.beginPath();
          for (let k = 0; k <= 30; k++) {
            const y = 400 - rise - k * 2;
            const x = bx + Math.sin((y + now / 20) / 8) * 5;
            k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
      }
    }
  }

  function drawTexts(now) {
    texts = texts.filter((t) => now - t.born < t.life);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "italic bold 24px Georgia, serif";
    for (const t of texts) {
      const k = (now - t.born) / t.life;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = "#4d6410";
      ctx.fillText(t.text, clamp(t.x, 60, W - 60), t.y + t.vy * k * (t.life / 1000));
    }
    ctx.globalAlpha = 1;
  }

  function drawBubble(now) {
    const b = dog.bubble;
    if (!b || now > b.until) return;
    ctx.font = "bold 24px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = Math.min(ctx.measureText(b.text).width + 28, W - 20);
    const h = 40;
    const ax = dog.x, ay = dog.y - dog.hop - 62;
    const bx = clamp(ax - w / 2, 10, W - w - 10);
    let by = ay - h - 10;
    if (by < 8) by = 8;
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    rr(bx + 3, by + 4, w, h, 14); ctx.fill();
    ctx.fillStyle = "#fff";
    rr(bx, by, w, h, 14); ctx.fill();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2.5; ctx.stroke();
    const tx = clamp(ax, bx + 18, bx + w - 18);
    if (by + h < ay) {
      ctx.beginPath();
      ctx.moveTo(tx - 9, by + h - 1); ctx.lineTo(tx, by + h + 12); ctx.lineTo(tx + 9, by + h - 1);
      ctx.closePath();
      ctx.fillStyle = "#fff"; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx - 9, by + h); ctx.lineTo(tx, by + h + 12); ctx.lineTo(tx + 9, by + h);
      ctx.stroke();
    }
    ctx.fillStyle = "#111";
    ctx.fillText(b.text, bx + w / 2, by + h / 2 + 1, w - 20);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    updateDog(dt, now);
    updatePuffs(dt, now);
    updateCleanup(dt, now);

    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawRoom(now);
    drawVacuum(now);
    drawDog(now);
    drawFlies(now);
    drawGas(now);
    drawWind(now);
    drawTexts(now);
    drawBubble(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- Input ----------
  // Clicking the room, or any empty part of the page (outside the Stackfall game and buttons), makes him toot.
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (!t.closest("main")) return;
    if (t.closest("#stackfall, a, button, input, select, textarea, label, summary, [contenteditable]")) return;
    fart();
  });
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      fart();
    }
  });
  if (tootBtn) tootBtn.addEventListener("click", fart);
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      muted = !muted;
      if (muted) stopHum();
      muteBtn.setAttribute("aria-pressed", String(muted));
      muteBtn.textContent = muted ? "🔇 Sound off" : "🔊 Sound on";
    });
  }
  updateMeter();
})();
