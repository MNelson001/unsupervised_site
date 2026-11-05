// Stackfall: a small falling-block game. Controls live in the bottom-right corner.
(() => {
  const COLS = 10;
  const ROWS = 20;
  const CELL = 20; // canvas units per cell (canvas is 200x400, scaled by CSS)

  const board = document.getElementById("sf-board");
  const nextCanvas = document.getElementById("sf-next");
  if (!board || !nextCanvas) return;
  const ctx = board.getContext("2d");
  const nctx = nextCanvas.getContext("2d");

  const overlay = document.getElementById("sf-overlay");
  const overlayText = document.getElementById("sf-overlay-text");
  const startBtn = document.getElementById("sf-start");
  const scoreEl = document.getElementById("sf-score");
  const linesEl = document.getElementById("sf-lines");
  const levelEl = document.getElementById("sf-level");
  const bestEl = document.getElementById("sf-best");

  // Seven four-cell shapes with this site's own palette.
  const SHAPES = [
    { color: "#ffb02e", cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    { color: "#5ad1c4", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { color: "#c77dff", cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    { color: "#7bd389", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    { color: "#ff6b6b", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    { color: "#5b8def", cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    { color: "#f78fb3", cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  ];

  let grid, piece, next, bag, score, lines, level, dropMs, lastTime, acc, state, rafId;
  let best = 0;
  try { best = Number(localStorage.getItem("stackfall-best")) || 0; } catch (e) {}
  bestEl.textContent = best;

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function takeFromBag() {
    if (!bag || !bag.length) {
      bag = SHAPES.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    const s = SHAPES[bag.pop()];
    return { color: s.color, cells: s.cells.map((c) => c.slice()), x: 3, y: 0 };
  }

  function fits(cells, x, y) {
    return cells.every(([cx, cy]) => {
      const gx = cx + x, gy = cy + y;
      return gx >= 0 && gx < COLS && gy < ROWS && (gy < 0 || !grid[gy][gx]);
    });
  }

  function rotated(cells) {
    // Rotate clockwise inside the shape's bounding box.
    const size = Math.max(...cells.map(([x, y]) => Math.max(x, y))) + 1;
    return cells.map(([x, y]) => [size - 1 - y, x]);
  }

  function spawn() {
    piece = next || takeFromBag();
    next = takeFromBag();
    piece.x = 3;
    piece.y = 0;
    drawNext();
    if (!fits(piece.cells, piece.x, piece.y)) gameOver();
  }

  function lock() {
    piece.cells.forEach(([cx, cy]) => {
      const gy = cy + piece.y;
      if (gy >= 0) grid[gy][cx + piece.x] = piece.color;
    });
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every(Boolean)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      score += [0, 100, 300, 500, 800][cleared] * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      dropMs = Math.max(90, 800 - (level - 1) * 70);
    }
    updateStats();
    spawn();
  }

  function move(dx, dy) {
    if (state !== "playing") return false;
    if (fits(piece.cells, piece.x + dx, piece.y + dy)) {
      piece.x += dx;
      piece.y += dy;
      draw();
      return true;
    }
    if (dy > 0) lock();
    draw();
    return false;
  }

  function rotate() {
    if (state !== "playing") return;
    const r = rotated(piece.cells);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (fits(r, piece.x + kick, piece.y)) {
        piece.cells = r;
        piece.x += kick;
        break;
      }
    }
    draw();
  }

  function softDrop() {
    if (move(0, 1)) { score += 1; updateStats(); }
    acc = 0;
  }

  function hardDrop() {
    if (state !== "playing") return;
    let n = 0;
    while (fits(piece.cells, piece.x, piece.y + 1)) { piece.y++; n++; }
    score += n * 2;
    lock();
    acc = 0;
    draw();
  }

  function updateStats() {
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      try { localStorage.setItem("stackfall-best", String(best)); } catch (e) {}
    }
  }

  function cell(c, x, y, color, size, alpha) {
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.fillStyle = color;
    c.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    c.fillStyle = "rgba(255,255,255,0.25)";
    c.fillRect(x * size + 1, y * size + 1, size - 2, 3);
    c.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, board.width, board.height);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke();
    }
    grid.forEach((row, y) => row.forEach((c, x) => { if (c) cell(ctx, x, y, c, CELL); }));
    if (piece && state !== "over") {
      let gy = piece.y;
      while (fits(piece.cells, piece.x, gy + 1)) gy++;
      piece.cells.forEach(([cx, cy]) => {
        if (cy + gy >= 0) cell(ctx, cx + piece.x, cy + gy, piece.color, CELL, 0.2);
      });
      piece.cells.forEach(([cx, cy]) => {
        if (cy + piece.y >= 0) cell(ctx, cx + piece.x, cy + piece.y, piece.color, CELL);
      });
    }
  }

  function drawNext() {
    nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!next) return;
    const size = 14;
    const xs = next.cells.map((c) => c[0]), ys = next.cells.map((c) => c[1]);
    const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
    const ox = (nextCanvas.width / size - w) / 2 - Math.min(...xs);
    const oy = (nextCanvas.height / size - h) / 2 - Math.min(...ys);
    nctx.save();
    nctx.translate(ox * size, oy * size);
    next.cells.forEach(([x, y]) => cell(nctx, x, y, next.color, size));
    nctx.restore();
  }

  function loop(t) {
    if (state !== "playing") return;
    if (lastTime == null) lastTime = t;
    acc += t - lastTime;
    lastTime = t;
    if (acc >= dropMs) {
      acc = 0;
      move(0, 1);
    }
    rafId = requestAnimationFrame(loop);
  }

  function showOverlay(text, btn) {
    overlayText.textContent = text;
    startBtn.textContent = btn;
    overlay.hidden = false;
  }

  function start() {
    grid = emptyGrid();
    bag = null;
    next = null;
    score = 0; lines = 0; level = 1; dropMs = 800; acc = 0; lastTime = null;
    state = "playing";
    updateStats();
    spawn();
    overlay.hidden = true;
    draw();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function pause() {
    if (state === "playing") {
      state = "paused";
      cancelAnimationFrame(rafId);
      showOverlay("Paused", "Resume");
    } else if (state === "paused") {
      state = "playing";
      overlay.hidden = true;
      lastTime = null;
      rafId = requestAnimationFrame(loop);
    } else {
      start();
    }
  }

  function gameOver() {
    state = "over";
    cancelAnimationFrame(rafId);
    draw();
    showOverlay(`Game over — ${score} points`, "Play again");
  }

  startBtn.addEventListener("click", () => {
    if (state === "paused") pause();
    else start();
  });

  // ----- Bottom-right buttons (mouse + touch, hold to repeat) -----
  const actions = {
    left: () => move(-1, 0),
    right: () => move(1, 0),
    down: softDrop,
    rotate,
    drop: hardDrop,
    pause,
  };
  const repeating = new Set(["left", "right", "down"]);

  document.querySelectorAll(".sf-controls button").forEach((btn) => {
    const act = btn.dataset.act;
    let delayT, repeatT;
    const stop = () => {
      clearTimeout(delayT);
      clearInterval(repeatT);
      btn.classList.remove("is-down");
    };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (act !== "pause" && (state === undefined || state === "over")) start();
      btn.classList.add("is-down");
      actions[act]();
      if (repeating.has(act)) {
        delayT = setTimeout(() => { repeatT = setInterval(actions[act], 60); }, 180);
      }
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, stop));
    // Keyboard activation of a focused button
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); actions[act](); }
    });
  });

  // ----- Touch / mouse gestures on the board: tap to rotate, swipe to move -----
  let sx = 0, sy = 0, lastX = 0, lastY = 0, moved = false, active = false;
  board.addEventListener("pointerdown", (e) => {
    if (state !== "playing") return;
    active = true; moved = false;
    sx = lastX = e.clientX; sy = lastY = e.clientY;
    board.setPointerCapture(e.pointerId);
  });
  board.addEventListener("pointermove", (e) => {
    if (!active) return;
    const step = board.getBoundingClientRect().width / COLS;
    while (e.clientX - lastX > step) { move(1, 0); lastX += step; moved = true; }
    while (lastX - e.clientX > step) { move(-1, 0); lastX -= step; moved = true; }
    while (e.clientY - lastY > step) { softDrop(); lastY += step; moved = true; }
  });
  board.addEventListener("pointerup", (e) => {
    if (!active) return;
    active = false;
    const dy = e.clientY - sy, dx = e.clientX - sx;
    if (!moved && Math.abs(dx) < 8 && Math.abs(dy) < 8) rotate();
  });
  board.addEventListener("pointercancel", () => { active = false; });

  // ----- Keyboard -----
  document.addEventListener("keydown", (e) => {
    if (state !== "playing" && state !== "paused") return;
    const map = {
      ArrowLeft: () => move(-1, 0),
      ArrowRight: () => move(1, 0),
      ArrowDown: softDrop,
      ArrowUp: rotate,
      " ": hardDrop,
      p: pause,
      P: pause,
      Escape: pause,
    };
    const fn = map[e.key];
    if (!fn) return;
    if (state === "paused" && !["p", "P", "Escape"].includes(e.key)) return;
    e.preventDefault();
    fn();
  });

  // Pause automatically when the tab is hidden.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") pause();
  });

  grid = emptyGrid();
  draw();
})();
