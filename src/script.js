// Angle Archers: a turn-based arrow duel. Aim by pulling back with mouse, trackpad or thumb.
(function () {
  const canvas = document.getElementById("arena");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const W = 1000, H = 560;
  const G = 600;            // gravity, world px / s^2
  const VMAX = 920;         // arrow speed at 100% power
  const MAX_HP = 100;

  const $ = (id) => document.getElementById(id);
  const ui = {
    hp: [$("hp1"), $("hp2")],
    turn: $("turn"),
    wind: $("wind"),
    p2name: $("p2name"),
    angle: $("angleOut"),
    power: $("powerOut"),
    fire: $("fire"),
    banner: $("banner"),
    bannerText: $("banner-text"),
    rematch: $("rematch"),
  };

  const COLORS = ["#c62828", "#1565c0"];
  const NAMES = ["Red", "Blue"];

  let mode = "pvp";
  let ground = new Float32Array(W + 1);
  let players, turn, wind, state, arrow, stuck, particles, floaters, drag, lastPaths, clouds;
  let scale = 1;

  // ---------- terrain ----------
  function makeTerrain() {
    const p1 = 0.1 + Math.random() * 0.06, p2 = Math.random() * 6.28;
    const hillH = 90 + Math.random() * 110;
    const hillX = 430 + Math.random() * 140;
    for (let x = 0; x <= W; x++) {
      let y = 450 - hillH * Math.exp(-Math.pow((x - hillX) / 150, 2));
      y += Math.sin(x * p1 * 0.1 + p2) * 18 + Math.sin(x * 0.031 + p2 * 2) * 8;
      ground[x] = y;
    }
    // flat platforms for the archers
    [110, 890].forEach((px) => {
      const base = ground[px] - 10;
      for (let x = px - 45; x <= px + 45; x++) {
        const t = Math.min(1, Math.max(0, (Math.abs(x - px) - 25) / 20));
        ground[x] = base * (1 - t) + ground[x] * t;
      }
    });
  }
  const groundAt = (x) => {
    if (x < 0 || x > W) return Infinity;
    const i = Math.floor(x), f = x - i;
    return ground[i] * (1 - f) + ground[Math.min(W, i + 1)] * f;
  };

  // ---------- setup ----------
  function newGame() {
    makeTerrain();
    players = [
      { x: 110, facing: 1, hp: MAX_HP, angle: 45, power: 60, hurt: 0 },
      { x: 890, facing: -1, hp: MAX_HP, angle: 45, power: 60, hurt: 0 },
    ];
    players.forEach((p) => (p.y = groundAt(p.x)));
    stuck = [];
    particles = [];
    floaters = [];
    lastPaths = [null, null];
    arrow = null;
    drag = null;
    turn = Math.random() < 0.5 ? 0 : 1;
    clouds = Array.from({ length: 5 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * 120, s: 0.6 + Math.random() * 0.8 }));
    ui.banner.hidden = true;
    ui.p2name.textContent = mode === "cpu" ? "Blue (CPU)" : "Blue";
    startTurn();
  }

  function rollWind() {
    const r = Math.random();
    wind = r < 0.2 ? 0 : Math.round((Math.random() * 2 - 1) * 90);
  }

  const isCpu = (i) => mode === "cpu" && i === 1;

  function startTurn() {
    rollWind();
    state = "aim";
    updateHud();
    if (isCpu(turn)) cpuTurn();
  }

  function updateHud() {
    players.forEach((p, i) => (ui.hp[i].style.width = Math.max(0, p.hp) + "%"));
    const p = players[turn];
    ui.turn.textContent = state === "over" ? "Game over" : NAMES[turn] + (isCpu(turn) ? " (CPU) is aiming…" : "'s turn");
    ui.turn.style.color = COLORS[turn];
    if (wind === 0) ui.wind.textContent = "Wind: calm";
    else ui.wind.textContent = "Wind: " + (wind > 0 ? "→ " : "← ") + Math.abs(wind);
    ui.angle.textContent = Math.round(p.angle) + "°";
    ui.power.textContent = Math.round(p.power) + "%";
    const canAct = state === "aim" && !isCpu(turn);
    ui.fire.disabled = !canAct;
    document.querySelectorAll("[data-adj]").forEach((b) => (b.disabled = !canAct));
  }

  // ---------- physics ----------
  function launchVector(p) {
    const a = (p.angle * Math.PI) / 180;
    const v = (p.power / 100) * VMAX;
    return { vx: Math.cos(a) * v * p.facing, vy: -Math.sin(a) * v };
  }
  function handPos(p) {
    return { x: p.x + 6 * p.facing, y: p.y - 36 };
  }

  // returns "head" | "body" | null
  function hitTest(p, x, y) {
    const hx = p.x, hy = p.y - 52;
    if ((x - hx) ** 2 + (y - hy) ** 2 < 11 * 11) return "head";
    if (Math.abs(x - p.x) < 9 && y > p.y - 44 && y < p.y) return "body";
    return null;
  }

  // Step an arrow-like object. Returns collision info or null.
  function stepArrow(a, dt, shooter) {
    a.vx += wind * dt;
    a.vy += G * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.t += dt;
    for (let i = 0; i < players.length; i++) {
      if (i === shooter && a.t < 0.25) continue;
      const part = hitTest(players[i], a.x, a.y);
      if (part) return { type: "player", who: i, part };
    }
    if (a.y >= groundAt(a.x)) return { type: "ground" };
    if (a.x < -200 || a.x > W + 200 || a.y > H + 100) return { type: "out" };
    return null;
  }

  function fire() {
    if (state !== "aim") return;
    const p = players[turn];
    const h = handPos(p);
    const v = launchVector(p);
    arrow = { x: h.x, y: h.y, vx: v.vx, vy: v.vy, t: 0, owner: turn, path: [[h.x, h.y]] };
    state = "flight";
    drag = null;
    updateHud();
  }

  function land(hit) {
    const a = arrow;
    const ang = Math.atan2(a.vy, a.vx);
    lastPaths[a.owner] = a.path;
    if (hit.type === "player") {
      const target = players[hit.who];
      const dmg = hit.part === "head" ? 50 : 25;
      target.hp = Math.max(0, target.hp - dmg);
      target.hurt = 0.5;
      stuck.push({ x: a.x, y: a.y, ang, color: COLORS[a.owner] });
      for (let i = 0; i < 14; i++) particles.push(spark(a.x, a.y, "#d32f2f"));
      floaters.push({ x: a.x, y: a.y - 20, text: (hit.part === "head" ? "HEADSHOT -" : "-") + dmg, life: 1.2, color: "#b71c1c" });
    } else if (hit.type === "ground") {
      stuck.push({ x: a.x, y: groundAt(a.x), ang, color: COLORS[a.owner] });
      for (let i = 0; i < 8; i++) particles.push(spark(a.x, groundAt(a.x), "#7a5a2f"));
    } else {
      floaters.push({ x: Math.min(W - 40, Math.max(40, a.x)), y: 60, text: "Missed!", life: 1, color: "#333" });
    }
    if (stuck.length > 30) stuck.shift();
    arrow = null;
    state = "wait";
    setTimeout(() => {
      const dead = players.findIndex((p) => p.hp <= 0);
      if (dead !== -1) return gameOver(1 - dead);
      turn = 1 - turn;
      startTurn();
    }, 750);
  }

  function spark(x, y, color) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
    return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.6 + Math.random() * 0.4, color };
  }

  function gameOver(winner) {
    state = "over";
    updateHud();
    ui.bannerText.textContent = NAMES[winner] + (isCpu(winner) ? " (CPU)" : "") + " wins!";
    ui.bannerText.style.color = COLORS[winner];
    ui.banner.hidden = false;
  }

  // ---------- computer opponent ----------
  function simulate(shooter, angle, power) {
    const p = players[shooter];
    const saved = { angle: p.angle, power: p.power };
    p.angle = angle; p.power = power;
    const h = handPos(p), v = launchVector(p);
    Object.assign(p, saved);
    const a = { x: h.x, y: h.y, vx: v.vx, vy: v.vy, t: 0 };
    const target = players[1 - shooter];
    const tx = target.x, ty = target.y - 30;
    let best = Infinity;
    for (let i = 0; i < 900; i++) {
      const hit = stepArrow(a, 1 / 120, shooter);
      const d = Math.hypot(a.x - tx, a.y - ty);
      if (d < best) best = d;
      if (hit) { if (hit.type === "player" && hit.who === 1 - shooter) best = 0; break; }
    }
    return best;
  }

  function cpuTurn() {
    const me = turn;
    setTimeout(() => {
      if (state !== "aim" || turn !== me || !isCpu(me)) return;
      let best = { d: Infinity, angle: 45, power: 60 };
      for (let ang = 15; ang <= 80; ang += 2.5) {
        for (let pow = 30; pow <= 100; pow += 2.5) {
          const d = simulate(me, ang, pow);
          if (d < best.d) best = { d, angle: ang, power: pow };
        }
      }
      const p = players[me];
      const targetAngle = Math.max(5, Math.min(85, best.angle + (Math.random() * 2 - 1) * 4));
      const targetPower = Math.max(20, Math.min(100, best.power + (Math.random() * 2 - 1) * 5));
      // animate the aim so players can see the angle chosen
      const start = { a: p.angle, pw: p.power }, t0 = performance.now(), dur = 700;
      (function anim(now) {
        if (state !== "aim" || turn !== me) return;
        const k = Math.min(1, (now - t0) / dur), e = k * (2 - k);
        p.angle = start.a + (targetAngle - start.a) * e;
        p.power = start.pw + (targetPower - start.pw) * e;
        updateHud();
        if (k < 1) requestAnimationFrame(anim);
        else setTimeout(fire, 250);
      })(t0);
    }, 600);
  }

  // ---------- input ----------
  function clampAim(p) {
    p.angle = Math.max(-30, Math.min(150, p.angle));
    p.power = Math.max(5, Math.min(100, p.power));
  }

  function canHumanAim() {
    return state === "aim" && !isCpu(turn);
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!canHumanAim()) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    canvas.focus({ preventScroll: true });
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, moved: false };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id || !canHumanAim()) return;
    drag.cx = e.clientX; drag.cy = e.clientY;
    const dx = drag.sx - drag.cx, dy = drag.sy - drag.cy;
    const len = Math.hypot(dx, dy);
    if (len < 8) return;
    drag.moved = true;
    const p = players[turn];
    const rect = canvas.getBoundingClientRect();
    const maxLen = Math.max(90, Math.min(200, rect.width * 0.3));
    p.angle = (Math.atan2(-dy, dx * p.facing) * 180) / Math.PI;
    p.power = (Math.min(len, maxLen) / maxLen) * 100;
    clampAim(p);
    updateHud();
  });
  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    if (!cancelled && moved && canHumanAim()) fire();
  }
  canvas.addEventListener("pointerup", (e) => endDrag(e, false));
  canvas.addEventListener("pointercancel", (e) => endDrag(e, true));

  canvas.addEventListener("keydown", (e) => {
    if (!canHumanAim()) return;
    const p = players[turn];
    const step = e.shiftKey ? 5 : 1;
    let handled = true;
    if (e.key === "ArrowUp") p.angle += step;
    else if (e.key === "ArrowDown") p.angle -= step;
    else if (e.key === "ArrowRight") p.power += step;
    else if (e.key === "ArrowLeft") p.power -= step;
    else if (e.key === " " || e.key === "Enter") fire();
    else handled = false;
    if (handled) { e.preventDefault(); clampAim(p); updateHud(); }
  });

  // Hold-to-repeat nudge buttons
  document.querySelectorAll("[data-adj]").forEach((btn) => {
    let timer = null;
    const nudge = () => {
      if (!canHumanAim()) return stop();
      const p = players[turn];
      p[btn.dataset.adj] += Number(btn.dataset.d);
      clampAim(p);
      updateHud();
    };
    const stop = () => { clearTimeout(timer); clearInterval(timer); timer = null; };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      nudge();
      stop();
      timer = setTimeout(() => (timer = setInterval(nudge, 60)), 350);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, stop));
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nudge(); }
    });
  });

  ui.fire.addEventListener("click", () => canHumanAim() && fire());
  ui.rematch.addEventListener("click", newGame);
  document.querySelectorAll(".mode-btn").forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.mode;
      document.querySelectorAll(".mode-btn").forEach((x) => x.classList.toggle("is-active", x === b));
      newGame();
    })
  );

  // ---------- rendering ----------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || W;
    const cssH = cssW * (H / W);
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = canvas.width / W;
  }
  window.addEventListener("resize", resize);

  function drawArrowShape(x, y, ang, color, len = 34) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = "#5d4037";
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-len - 6, -5); ctx.lineTo(-len + 4, 0); ctx.lineTo(-len - 6, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawArcher(p, i) {
    const shake = p.hurt > 0 ? Math.sin(p.hurt * 60) * 2 : 0;
    const x = p.x + shake, y = p.y;
    const col = COLORS[i];
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 3;
    // legs
    ctx.beginPath();
    ctx.moveTo(x - 7, y); ctx.lineTo(x, y - 20); ctx.lineTo(x + 7, y);
    ctx.stroke();
    // body / tunic
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 18); ctx.lineTo(x + 8, y - 18); ctx.lineTo(x + 6, y - 43); ctx.lineTo(x - 6, y - 43); ctx.closePath();
    ctx.fill();
    // head
    ctx.fillStyle = p.hurt > 0 ? "#ffcdd2" : "#f6d2a8";
    ctx.beginPath(); ctx.arc(x, y - 52, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // hat
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 56); ctx.lineTo(x + 10, y - 56); ctx.lineTo(x - 4 * p.facing, y - 70); ctx.closePath();
    ctx.fill();
    // bow arm aimed at current angle
    const a = (p.angle * Math.PI) / 180;
    const dirX = Math.cos(a) * p.facing, dirY = -Math.sin(a);
    const h = handPos(p);
    const bx = h.x + dirX * 16, by = h.y + dirY * 16;
    ctx.beginPath(); ctx.moveTo(x, y - 38); ctx.lineTo(bx, by); ctx.stroke();
    // bow
    const nx = -dirY, ny = dirX;
    const pull = i === turn && state === "aim" ? 4 + (p.power / 100) * 10 : 3;
    ctx.strokeStyle = "#6d4c41";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx + nx * 16, by + ny * 16);
    ctx.quadraticCurveTo(bx + dirX * 10, by + dirY * 10, bx - nx * 16, by - ny * 16);
    ctx.stroke();
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + nx * 16, by + ny * 16);
    ctx.lineTo(bx - dirX * pull, by - dirY * pull);
    ctx.lineTo(bx - nx * 16, by - ny * 16);
    ctx.stroke();
    ctx.restore();
    // nocked arrow
    if (i === turn && state === "aim") drawArrowShape(bx + dirX * 8, by + dirY * 8, Math.atan2(dirY, dirX), col, 30);
  }

  function drawAimGuide(p) {
    const h = handPos(p);
    const a = (p.angle * Math.PI) / 180;
    // protractor arc
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    const r = 55;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + r * p.facing, h.y);
    ctx.stroke();
    ctx.beginPath();
    if (p.facing > 0) ctx.arc(h.x, h.y, r * 0.7, -a, 0, a < 0);
    else ctx.arc(h.x, h.y, r * 0.7, Math.PI, Math.PI + a, a < 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#111";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    const mid = a / 2;
    ctx.fillText(Math.round(p.angle) + "°", h.x + Math.cos(mid) * (r + 14) * p.facing, h.y - Math.sin(mid) * (r + 14) + 5);
    // short trajectory preview (gravity only, first part)
    const v = launchVector(p);
    let x = h.x, y = h.y, vx = v.vx, vy = v.vy;
    ctx.fillStyle = COLORS[turn];
    for (let i = 0; i < 14; i++) {
      for (let k = 0; k < 3; k++) { vy += G / 120; x += vx / 120; y += vy / 120; }
      ctx.globalAlpha = 1 - i / 14;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawWindFlag() {
    const x = W / 2, y = 30;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fillRect(x - 70, y - 16, 140, 32);
    ctx.fillStyle = "#222";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    if (wind === 0) ctx.fillText("calm", x, y + 5);
    else {
      const len = (Math.abs(wind) / 90) * 50 + 8, d = Math.sign(wind);
      ctx.strokeStyle = "#222"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - (len / 2) * d, y); ctx.lineTo(x + (len / 2) * d, y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + (len / 2 + 8) * d, y); ctx.lineTo(x + (len / 2) * d, y - 6); ctx.lineTo(x + (len / 2) * d, y + 6); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#8fd0f0"); sky.addColorStop(1, "#e8f6fc");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // clouds
    ctx.fillStyle = "rgba(255,255,255,.85)";
    clouds.forEach((c) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 18 * c.s, 0, 7); ctx.arc(c.x + 22 * c.s, c.y - 8 * c.s, 22 * c.s, 0, 7); ctx.arc(c.x + 46 * c.s, c.y, 17 * c.s, 0, 7);
      ctx.fill();
    });
    // ground
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) ctx.lineTo(x, ground[x]);
    ctx.lineTo(W, H); ctx.closePath();
    const gg = ctx.createLinearGradient(0, 250, 0, H);
    gg.addColorStop(0, "#7cb342"); gg.addColorStop(1, "#4e7a24");
    ctx.fillStyle = gg; ctx.fill();
    ctx.strokeStyle = "#33691e"; ctx.lineWidth = 3; ctx.stroke();

    drawWindFlag();

    // last shot paths
    lastPaths.forEach((path, i) => {
      if (!path || i !== turn || state !== "aim") return;
      ctx.save();
      ctx.strokeStyle = COLORS[i]; ctx.globalAlpha = 0.25; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath();
      path.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    });

    stuck.forEach((s) => drawArrowShape(s.x, s.y, s.ang, s.color, 30));
    players.forEach(drawArcher);
    if (state === "aim") drawAimGuide(players[turn]);
    if (arrow) drawArrowShape(arrow.x, arrow.y, Math.atan2(arrow.vy, arrow.vx), COLORS[arrow.owner]);

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
    floaters.forEach((f) => {
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.fillStyle = f.color;
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    // drag indicator (screen-space pull line)
    if (drag && drag.moved) {
      const rect = canvas.getBoundingClientRect();
      const k = W / rect.width;
      const sx = (drag.sx - rect.left) * k, sy = (drag.sy - rect.top) * k;
      const cx = (drag.cx - rect.left) * k, cy = (drag.cy - rect.top) * k;
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(0,0,0,.4)";
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (arrow && state === "flight") {
      const sub = 6;
      for (let i = 0; i < sub; i++) {
        const hit = stepArrow(arrow, dt / sub, arrow.owner);
        if (hit) { land(hit); break; }
      }
      if (arrow) arrow.path.push([arrow.x, arrow.y]);
    }
    players.forEach((p) => (p.hurt = Math.max(0, p.hurt - dt)));
    particles.forEach((p) => { p.vy += G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    particles = particles.filter((p) => p.life > 0);
    floaters.forEach((f) => { f.y -= 30 * dt; f.life -= dt; });
    floaters = floaters.filter((f) => f.life > 0);
    clouds.forEach((c) => { c.x += wind * 0.08 * dt + 3 * dt; if (c.x > W + 60) c.x = -100; if (c.x < -120) c.x = W + 40; });
    render();
    requestAnimationFrame(loop);
  }

  resize();
  newGame();
  requestAnimationFrame(loop);
})();
