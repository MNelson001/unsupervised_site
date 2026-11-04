// unsupervised.website — every feature lives in its own block below.

/* ---------- shared audio ---------- */
let audioCtx = null;
function getAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------- 1. Bouncing cat ---------- */
(() => {
  const cat = document.getElementById("bounce-cat");
  if (!cat) return;
  const W = 70, H = 63, FOOTER = 48;
  let x = rand(0, window.innerWidth - W), y = rand(0, window.innerHeight - H - FOOTER);
  let angle = rand(0, Math.PI * 2), speed = 2.4;
  let vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
  let squish = 0, spin = 0, nextTurn = performance.now() + rand(1500, 4000);

  function meow() {
    const ac = getAudio();
    if (!ac) return;
    const t = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = "sawtooth";
    f.type = "bandpass"; f.frequency.value = 1200; f.Q.value = 2;
    o.frequency.setValueAtTime(500, t);
    o.frequency.linearRampToValueAtTime(900, t + 0.15);
    o.frequency.linearRampToValueAtTime(450, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(f).connect(g).connect(ac.destination);
    o.start(t); o.stop(t + 0.6);
  }

  cat.addEventListener("click", () => {
    meow();
    angle = rand(0, Math.PI * 2);
    vx = Math.cos(angle) * 9; vy = Math.sin(angle) * 9;
    spin = 360;
  });

  function step(now) {
    const maxX = window.innerWidth - W, maxY = window.innerHeight - H - FOOTER;
    if (now > nextTurn) {
      angle = Math.atan2(vy, vx) + rand(-1.2, 1.2);
      speed = rand(1.8, 4);
      vx = Math.cos(angle) * speed; vy = Math.sin(angle) * speed;
      nextTurn = now + rand(1500, 4000);
    }
    // ease boosted speed back down
    const cur = Math.hypot(vx, vy);
    if (cur > speed) { vx *= 0.985; vy *= 0.985; }
    x += vx; y += vy;
    if (x < 0) { x = 0; vx = Math.abs(vx); squish = 1; }
    if (x > maxX) { x = maxX; vx = -Math.abs(vx); squish = 1; }
    if (y < 0) { y = 0; vy = Math.abs(vy); squish = 1; }
    if (y > maxY) { y = Math.max(0, maxY); vy = -Math.abs(vy); squish = 1; }
    squish *= 0.85; spin *= 0.92;
    const sx = 1 + squish * 0.25, sy = 1 - squish * 0.25;
    const flip = vx < 0 ? -1 : 1;
    cat.style.transform = `translate(${x}px, ${y}px) rotate(${spin}deg) scale(${sx * flip}, ${sy})`;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();

/* ---------- 2. Miami cruise ---------- */
(() => {
  const canvas = document.getElementById("miami-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const ROAD_Y = 330, CAR_BASE = 398, CAR_LEN = 270;
  const OUT = "#14101f";

  // Pre-render the static background
  const bg = document.createElement("canvas");
  bg.width = W; bg.height = H;
  const b = bg.getContext("2d");

  // sky
  const sky = b.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, "#5b2a86"); sky.addColorStop(0.45, "#ff5fa2"); sky.addColorStop(1, "#ffb86b");
  b.fillStyle = sky; b.fillRect(0, 0, W, 210);
  // retro striped sun
  b.save();
  b.beginPath(); b.arc(640, 175, 85, 0, Math.PI * 2); b.clip();
  const sun = b.createLinearGradient(0, 90, 0, 260);
  sun.addColorStop(0, "#fff36b"); sun.addColorStop(1, "#ff7a3d");
  b.fillStyle = sun; b.fillRect(540, 80, 200, 200);
  b.fillStyle = "#ff8fb8";
  for (let i = 0; i < 6; i++) b.fillRect(540, 150 + i * 11, 200, 2 + i * 1.2);
  b.restore();
  // clouds
  b.fillStyle = "rgba(255,255,255,.85)";
  [[120, 60], [330, 40], [820, 70]].forEach(([cx, cy]) => {
    b.beginPath();
    b.ellipse(cx, cy, 50, 14, 0, 0, Math.PI * 2);
    b.ellipse(cx + 30, cy - 8, 30, 14, 0, 0, Math.PI * 2);
    b.ellipse(cx - 28, cy - 4, 24, 10, 0, 0, Math.PI * 2);
    b.fill();
  });
  // distant pastel deco skyline across the water
  const pastels = ["#ffd1dc", "#b8f2e6", "#fff1a8", "#c9b6ff", "#9ee7ff"];
  let sx = 0;
  while (sx < 420) {
    const bw = rand(26, 50), bh = rand(40, 120);
    b.fillStyle = pastels[Math.floor(rand(0, pastels.length))];
    b.strokeStyle = OUT; b.lineWidth = 2;
    b.fillRect(sx, 205 - bh, bw, bh); b.strokeRect(sx, 205 - bh, bw, bh);
    b.fillStyle = "rgba(20,16,31,.35)";
    for (let wy = 205 - bh + 8; wy < 198; wy += 12) b.fillRect(sx + 5, wy, bw - 10, 3);
    if (Math.random() < 0.4) { b.fillStyle = OUT; b.fillRect(sx + bw / 2 - 1, 205 - bh - 14, 2, 14); }
    sx += bw + rand(2, 8);
  }
  // ocean
  const sea = b.createLinearGradient(0, 205, 0, 260);
  sea.addColorStop(0, "#2ec4d6"); sea.addColorStop(1, "#7ff0e0");
  b.fillStyle = sea; b.fillRect(0, 205, W, 60);
  b.strokeStyle = "rgba(255,255,255,.7)"; b.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const wx = rand(0, W), wy = rand(212, 255);
    b.beginPath(); b.moveTo(wx, wy); b.lineTo(wx + rand(10, 30), wy); b.stroke();
  }
  b.fillStyle = "rgba(255,240,150,.6)"; // sun glitter
  for (let i = 0; i < 12; i++) b.fillRect(600 + rand(-40, 40), 210 + i * 4, rand(10, 40), 2);
  // sand
  b.fillStyle = "#ffe2a8"; b.beginPath();
  b.moveTo(0, 262); b.quadraticCurveTo(W / 2, 250, W, 262); b.lineTo(W, ROAD_Y); b.lineTo(0, ROAD_Y); b.fill();
  b.fillStyle = "rgba(255,255,255,.8)"; b.fillRect(0, 258, W, 3);
  // umbrellas + towels
  [[180, "#ff4d6d"], [470, "#3ec1d3"], [760, "#ffcc29"]].forEach(([ux, col]) => {
    b.fillStyle = col === "#ffcc29" ? "#ff4d6d" : "#ffcc29";
    b.fillRect(ux - 30, 300, 40, 12);
    b.strokeStyle = OUT; b.lineWidth = 3;
    b.beginPath(); b.moveTo(ux, 310); b.lineTo(ux + 4, 270); b.stroke();
    b.fillStyle = col; b.beginPath();
    b.moveTo(ux - 30, 278); b.quadraticCurveTo(ux + 4, 240, ux + 38, 278); b.closePath(); b.fill(); b.stroke();
  });
  // palm trees
  function palm(px, scale) {
    b.save(); b.translate(px, ROAD_Y + 2); b.scale(scale, scale);
    b.strokeStyle = OUT; b.lineWidth = 3;
    b.fillStyle = "#a0662f";
    b.beginPath(); b.moveTo(-6, 0); b.quadraticCurveTo(10, -80, 20, -150); b.lineTo(30, -150);
    b.quadraticCurveTo(20, -80, 8, 0); b.closePath(); b.fill(); b.stroke();
    b.fillStyle = "#1fa65a";
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55;
      b.save(); b.translate(25, -150); b.rotate(a + Math.PI / 2);
      b.beginPath(); b.moveTo(0, 0); b.quadraticCurveTo(30, -25, 70, 10); b.quadraticCurveTo(30, -5, 0, 0);
      b.fill(); b.stroke(); b.restore();
    }
    b.restore();
  }
  palm(60, 1); palm(330, 0.85); palm(600, 1.05); palm(900, 0.9);
  // road
  b.fillStyle = "#3b3550"; b.fillRect(0, ROAD_Y, W, H - ROAD_Y);
  b.fillStyle = "#ff6fae"; b.fillRect(0, ROAD_Y, W, 6);
  b.fillStyle = "#fff6c2";
  for (let i = 0; i < W; i += 70) b.fillRect(i, 372, 38, 5);

  // Car drawing (anime-style cel-shaded sedan, facing right)
  function drawCar(x, wheelRot, speed) {
    ctx.save();
    ctx.translate(x, CAR_BASE);
    ctx.lineJoin = "round";
    // shadow
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath(); ctx.ellipse(CAR_LEN / 2, 2, CAR_LEN / 2 + 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    // body
    ctx.beginPath();
    ctx.moveTo(4, -18);
    ctx.lineTo(262, -18);
    ctx.quadraticCurveTo(272, -22, 270, -40);
    ctx.quadraticCurveTo(266, -52, 240, -56);
    ctx.lineTo(196, -62);
    ctx.quadraticCurveTo(172, -92, 150, -96);
    ctx.lineTo(96, -96);
    ctx.quadraticCurveTo(74, -92, 56, -66);
    ctx.lineTo(18, -62);
    ctx.quadraticCurveTo(0, -58, 0, -40);
    ctx.closePath();
    const paint = ctx.createLinearGradient(0, -96, 0, -18);
    paint.addColorStop(0, "#3a3d4a"); paint.addColorStop(0.5, "#15161c"); paint.addColorStop(1, "#050507");
    ctx.fillStyle = paint; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
    // windows
    ctx.beginPath();
    ctx.moveTo(186, -63); ctx.quadraticCurveTo(168, -88, 148, -90);
    ctx.lineTo(100, -90); ctx.quadraticCurveTo(82, -86, 68, -66); ctx.closePath();
    const glass = ctx.createLinearGradient(70, -90, 180, -63);
    glass.addColorStop(0, "#9be7ff"); glass.addColorStop(1, "#ff9ad0");
    ctx.fillStyle = glass; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.7)"; // glass glint
    ctx.beginPath(); ctx.moveTo(150, -88); ctx.lineTo(160, -88); ctx.lineTo(140, -66); ctx.lineTo(130, -66); ctx.fill();
    ctx.fillStyle = OUT; ctx.fillRect(122, -90, 6, 26); // B-pillar
    // chrome trim + cel highlight
    ctx.strokeStyle = "#d9dde8"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, -30); ctx.lineTo(258, -30); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(30, -52); ctx.lineTo(225, -54); ctx.stroke();
    // door lines + handles
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(125, -64); ctx.lineTo(125, -20); ctx.moveTo(185, -62); ctx.lineTo(188, -22); ctx.stroke();
    ctx.fillStyle = "#cfd3dd"; ctx.fillRect(105, -50, 12, 3); ctx.fillRect(165, -50, 12, 3);
    // lights
    ctx.fillStyle = "#fffbd1"; ctx.beginPath(); ctx.ellipse(262, -44, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff2d55"; ctx.fillRect(1, -52, 7, 12);
    // headlight beam when moving
    if (speed > 0.5) {
      ctx.fillStyle = `rgba(255,250,200,${Math.min(0.35, speed / 20)})`;
      ctx.beginPath(); ctx.moveTo(266, -46); ctx.lineTo(360, -70); ctx.lineTo(360, -10); ctx.closePath(); ctx.fill();
    }
    // wheels
    [62, 210].forEach((wx) => {
      ctx.save(); ctx.translate(wx, -18);
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#c9ccd6"; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(wheelRot);
      ctx.strokeStyle = "#555a66"; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.rotate((Math.PI * 2) / 5);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 12); ctx.stroke();
      }
      ctx.restore();
    });
    // anime sparkle on the roof
    const s = 7 + Math.sin(performance.now() / 150) * 3;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(110, -96 - s); ctx.lineTo(112, -98); ctx.lineTo(110 + s, -96); ctx.lineTo(112, -94);
    ctx.lineTo(110, -96 + s); ctx.lineTo(108, -94); ctx.lineTo(110 - s, -96); ctx.lineTo(108, -98); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  let carX = 40, speed = 0, wheelRot = 0, driving = false;
  const puffs = [];
  const lines = [];

  const wrap = canvas.parentElement;
  const start = (e) => { driving = true; getAudio(); if (e.cancelable) e.preventDefault(); };
  const stop = () => { driving = false; };
  wrap.addEventListener("pointerdown", start);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  wrap.addEventListener("contextmenu", (e) => e.preventDefault());

  function frame() {
    speed = driving ? Math.min(14, speed + 0.25) : Math.max(0, speed - 0.3);
    carX += speed;
    if (carX > W + 20) carX = -CAR_LEN - 20;
    wheelRot += speed / 22;

    ctx.drawImage(bg, 0, 0);

    // anime speed lines
    if (speed > 3 && Math.random() < speed / 14) {
      lines.push({ x: W + 10, y: rand(250, H - 10), len: rand(60, 180), life: 1 });
    }
    ctx.strokeStyle = "#fff";
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      l.x -= 30; l.life -= 0.04;
      if (l.life <= 0 || l.x + l.len < 0) { lines.splice(i, 1); continue; }
      ctx.globalAlpha = l.life * 0.8; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + l.len, l.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // exhaust puffs
    if (speed > 0.5 && Math.random() < 0.5) puffs.push({ x: carX - 4, y: CAR_BASE - 24, r: 4, a: 0.6 });
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.x -= 1.5; p.y -= 0.4; p.r += 0.6; p.a -= 0.02;
      if (p.a <= 0) { puffs.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(230,230,240,${p.a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

    const bob = speed > 0 ? Math.sin(performance.now() / 60) * 0.8 : 0;
    ctx.save(); ctx.translate(0, bob);
    drawCar(carX, wheelRot, speed);
    ctx.restore();

    if (!driving && speed === 0) {
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.fillStyle = "#fff";
      const msg = "HOLD TO DRIVE";
      ctx.strokeText(msg, W / 2, 40); ctx.fillText(msg, W / 2, 40);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ---------- 3. Everything is cake ---------- */
(() => {
  const canvas = document.getElementById("cake-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const SPRINKLES = ["#ff4d6d", "#ffd23f", "#3ec1d3", "#7bd389", "#b388ff", "#ffffff"];

  function backdrop() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#fff0f5"); g.addColorStop(1, "#fbd3e0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.6)";
    for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.arc(rand(0, W), rand(0, H), rand(2, 6), 0, Math.PI * 2); ctx.fill(); }
  }
  function plate(cx, cy, rx) {
    ctx.fillStyle = "#d9dbe3"; ctx.beginPath(); ctx.ellipse(cx, cy + 6, rx, rx * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#c4c7d1"; ctx.lineWidth = 2; ctx.stroke();
  }
  function sprinkles(c, x0, y0, x1, y1, n) {
    for (let i = 0; i < n; i++) {
      c.save();
      c.translate(rand(x0, x1), rand(y0, y1)); c.rotate(rand(0, Math.PI));
      c.fillStyle = SPRINKLES[Math.floor(rand(0, SPRINKLES.length))];
      c.fillRect(-5, -1.5, 10, 3);
      c.restore();
    }
  }
  function candle(x, y) {
    ctx.fillStyle = "#7ad3ff"; ctx.fillRect(x - 5, y - 46, 10, 46);
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 4; i++) ctx.fillRect(x - 5, y - 40 + i * 11, 10, 4);
    ctx.fillStyle = "#ffb703"; ctx.beginPath(); ctx.ellipse(x, y - 56, 6, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff3b0"; ctx.beginPath(); ctx.ellipse(x, y - 53, 2.5, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
  function frostingDrips(c, x0, x1, y, color, minLen, maxLen) {
    c.fillStyle = color;
    c.beginPath(); c.moveTo(x0, y - 2);
    let x = x0;
    while (x < x1) {
      const w = rand(14, 30), len = rand(minLen, maxLen);
      c.lineTo(x, y);
      c.lineTo(x + 2, y + len - w / 2);
      c.arc(x + w / 2, y + len - w / 2, w / 2 - 2, Math.PI, 0, true);
      c.lineTo(x + w, y);
      x += w + rand(0, 10);
    }
    c.lineTo(x1, y - 2); c.closePath(); c.fill();
  }

  // Words -> letters made of cake
  function cakeWords(text) {
    text = text.trim() || "CAKE";
    backdrop();
    const words = text.split(/\s+/);
    let rows = [text];
    if (text.length > 12 && words.length > 1) {
      const mid = Math.ceil(words.length / 2);
      rows = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    }
    const font = (s) => `900 ${s}px "Arial Black", Impact, system-ui, sans-serif`;
    let size = 200;
    ctx.font = font(size);
    const widest = Math.max(...rows.map((r) => ctx.measureText(r).width));
    size = Math.min(200, Math.floor(size * (W - 80) / widest), Math.floor(360 / rows.length));
    const lineH = size * 1.05;
    const totalH = lineH * rows.length;
    const top = (H - 70 - totalH) / 2 + 20;

    plate(W / 2, top + totalH + 22, Math.min(W / 2 - 20, 360));

    // letter mask canvas
    const L = document.createElement("canvas"); L.width = W; L.height = H;
    const l = L.getContext("2d");
    l.font = font(size); l.textAlign = "center"; l.textBaseline = "top";
    l.fillStyle = "#000";
    rows.forEach((r, i) => l.fillText(r, W / 2, top + i * lineH));
    // sponge side (extrusion) colour version
    const S = document.createElement("canvas"); S.width = W; S.height = H;
    const s = S.getContext("2d");
    s.drawImage(L, 0, 0);
    s.globalCompositeOperation = "source-in";
    s.fillStyle = "#a8692f"; s.fillRect(0, 0, W, H);
    // paint cake layers inside letters
    l.globalCompositeOperation = "source-atop";
    rows.forEach((r, i) => {
      const y0 = top + i * lineH, h = size;
      const bands = [["#ffd6e5", 0.24], ["#e8b46a", 0.16], ["#fff6e0", 0.08], ["#d6336c", 0.06], ["#e8b46a", 0.16], ["#fff6e0", 0.08], ["#e8b46a", 0.22]];
      let y = y0;
      bands.forEach(([c, f]) => { l.fillStyle = c; l.fillRect(0, y, W, h * f + 1); y += h * f; });
      frostingDrips(l, 0, W, y0 + h * 0.22, "#ffd6e5", 6, h * 0.22);
      // crumb texture
      l.fillStyle = "rgba(140,80,30,.25)";
      for (let k = 0; k < 500; k++) l.fillRect(rand(0, W), rand(y0 + h * 0.3, y0 + h), 2, 2);
      sprinkles(l, 0, y0, W, y0 + h * 0.2, 160);
    });
    // extrusion for 3D look
    for (let d = 10; d > 0; d--) ctx.drawImage(S, d, d);
    ctx.drawImage(L, 0, 0);
    // candles on top of the first row
    const n = Math.min(3, Math.max(1, Math.round(rows[0].length / 4)));
    ctx.font = font(size);
    const w0 = ctx.measureText(rows[0]).width;
    for (let i = 0; i < n; i++) candle(W / 2 - w0 / 2 + (w0 * (i + 1)) / (n + 1), top + size * 0.12);
  }

  // Image -> round cake with the picture printed on top and baked in
  function cakeImage(img) {
    backdrop();
    const cx = W / 2, topY = 220, rx = 300, ry = 95, sideH = 190;
    plate(cx, topY + sideH + 20, rx + 50);
    // side of the cake
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - rx, topY);
    ctx.lineTo(cx - rx, topY + sideH);
    ctx.ellipse(cx, topY + sideH, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, topY);
    ctx.closePath(); ctx.clip();
    const bands = [["#e8b46a", 0.3], ["#fff6e0", 0.1], ["#d6336c", 0.07], ["#e8b46a", 0.3], ["#fff6e0", 0.1], ["#e8b46a", 0.4]];
    let y = topY;
    bands.forEach(([c, f]) => { ctx.fillStyle = c; ctx.fillRect(0, y, W, (sideH + ry) * f + 1); y += (sideH + ry) * f; });
    const shade = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    shade.addColorStop(0, "rgba(0,0,0,.25)"); shade.addColorStop(0.4, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,.3)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(140,80,30,.25)";
    for (let k = 0; k < 800; k++) ctx.fillRect(rand(cx - rx, cx + rx), rand(topY, topY + sideH + ry), 2, 2);
    ctx.restore();
    // top: the image as an edible print, posterized like fondant
    const T = document.createElement("canvas"); T.width = rx * 2; T.height = ry * 2;
    const t = T.getContext("2d");
    const scale = Math.max(T.width / img.width, (T.height * 2.6) / img.height);
    t.drawImage(img, (T.width - img.width * scale) / 2, (T.height - img.height * scale / 2.6) / 2, img.width * scale, img.height * scale / 2.6);
    try {
      const d = t.getImageData(0, 0, T.width, T.height), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          let v = Math.round(p[i + c] / 51) * 51;           // posterize
          v = v * 0.8 + [255, 214, 229][c] * 0.2;            // sugary pastel tint
          p[i + c] = v;
        }
      }
      t.putImageData(d, 0, 0);
    } catch (e) { /* ignore */ }
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#ffd6e5"; ctx.fillRect(cx - rx, topY - ry, rx * 2, ry * 2);
    ctx.drawImage(T, cx - rx, topY - ry);
    ctx.restore();
    // frosting drips over the rim
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - rx, topY, rx * 2, sideH + ry); ctx.clip();
    ctx.translate(0, 0);
    const D = document.createElement("canvas"); D.width = W; D.height = H;
    const dc = D.getContext("2d");
    frostingDrips(dc, cx - rx, cx + rx, topY, "#ffd6e5", 15, 70);
    // bend the drips to follow the round front edge
    for (let col = 0; col < rx * 2; col += 4) {
      const xx = cx - rx + col;
      const off = ry * Math.sqrt(Math.max(0, 1 - ((xx - cx) / rx) ** 2));
      ctx.drawImage(D, xx, topY - 2, 4, 90, xx, topY + off - 6, 4, 90);
    }
    ctx.restore();
    // piped dollops around the rim
    for (let a = 0; a < Math.PI * 2; a += 0.16) {
      const px = cx + Math.cos(a) * rx, py = topY + Math.sin(a) * ry;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffd6e5"; ctx.beginPath(); ctx.arc(px - 2, py - 3, 8, 0, Math.PI * 2); ctx.fill();
    }
    sprinkles(ctx, cx - rx, topY - ry - 10, cx + rx, topY - ry + 12, 40);
    // cherry on top
    ctx.strokeStyle = "#2d6a4f"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, topY - ry - 10); ctx.quadraticCurveTo(cx + 10, topY - ry - 40, cx + 24, topY - ry - 46); ctx.stroke();
    ctx.fillStyle = "#d00000"; ctx.beginPath(); ctx.arc(cx, topY - ry - 4, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(cx - 5, topY - ry - 9, 4, 0, Math.PI * 2); ctx.fill();
  }

  const input = document.getElementById("cake-text");
  document.getElementById("cake-words").addEventListener("click", () => cakeWords(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") cakeWords(input.value); });
  document.getElementById("cake-file").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file); // stays local, nothing is uploaded
    const img = new Image();
    img.onload = () => { cakeImage(img); URL.revokeObjectURL(url); };
    img.src = url;
  });
  cakeWords("CAKE");
})();

/* ---------- 4. The toxic living room ---------- */
(() => {
  const scene = document.getElementById("fart-scene");
  const canvas = document.getElementById("smoke-canvas");
  if (!scene || !canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const bar = document.getElementById("smoke-bar");
  const folks = document.getElementById("folks");
  let level = 0, ending = false;
  const clouds = [];

  function fart() {
    const ac = getAudio();
    if (!ac) return;
    const t = ac.currentTime, dur = rand(0.35, 1.2);
    const o = ac.createOscillator(), lfo = ac.createOscillator(), lfoGain = ac.createGain();
    const f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = "sawtooth";
    const base = rand(55, 110);
    o.frequency.setValueAtTime(base * 1.3, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.7, t + dur);
    lfo.type = "square"; lfo.frequency.value = rand(14, 32);
    lfoGain.gain.value = base * 0.4;
    lfo.connect(lfoGain).connect(o.frequency);
    f.type = "lowpass"; f.frequency.value = rand(350, 700); f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.04);
    g.gain.setValueAtTime(0.45, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(ac.destination);
    // breathy noise layer
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * 0.4;
    const n = ac.createBufferSource(), nf = ac.createBiquadFilter(), ng = ac.createGain();
    n.buffer = buf; nf.type = "lowpass"; nf.frequency.value = 400;
    ng.gain.setValueAtTime(0.25, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(nf).connect(ng).connect(ac.destination);
    o.start(t); lfo.start(t); n.start(t);
    o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  function puff(x, y) {
    for (let i = 0; i < 14; i++) {
      clouds.push({
        x, y, r: rand(8, 18), max: rand(45, 90),
        vx: rand(-2.5, 2.5), vy: rand(-2.5, 0.8),
        hue: rand(70, 110), a: rand(0.35, 0.6),
      });
    }
  }

  scene.addEventListener("click", (e) => {
    if (ending) return;
    const obj = e.target.closest(".obj");
    if (!obj) return;
    obj.classList.remove("wobble"); void obj.getBBox(); obj.classList.add("wobble");
    const r = scene.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    fart(); puff(x, y);
    level = Math.min(100, level + rand(9, 14));
    bar.style.width = level + "%";
    if (level >= 100) {
      ending = true;
      setTimeout(() => { folks.hidden = false; }, 900);
      setTimeout(() => {
        folks.hidden = true; clouds.length = 0; level = 0; bar.style.width = "0%"; ending = false;
      }, 5000);
    }
  });

  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const c of clouds) {
      c.x += c.vx; c.y += c.vy;
      c.vx *= 0.97; c.vy *= 0.97;
      c.vx += rand(-0.05, 0.05); c.vy -= 0.003;
      if (c.r < c.max) c.r += 0.8;
      if (c.x < 0 || c.x > W) c.vx *= -1;
      if (c.y < 0 || c.y > H) c.vy *= -1;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, `hsla(${c.hue},65%,45%,${c.a})`);
      g.addColorStop(1, `hsla(${c.hue},65%,45%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
    }
    // overall haze thickens with the smoke level
    if (level > 0) {
      ctx.fillStyle = `rgba(110,140,40,${Math.pow(level / 100, 1.6) * 0.97})`;
      ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
