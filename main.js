// main.js – 2D-Bürogummi-Runner mit Büro-Hintergrund & Büro-Obstacles

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const timeEl = document.getElementById("time");
  const startScreen = document.getElementById("start-screen");
  const gameOverScreen = document.getElementById("gameover-screen");
  const startBtn = document.getElementById("start-button");
  const restartBtn = document.getElementById("restart-button");
  const finalScoreEl = document.getElementById("final-score");
  const charButtons = document.querySelectorAll(".character-select button");

  if (!canvas || !ctx) {
    console.error("Canvas nicht gefunden – prüfe index.html");
    return;
  }

  const width = canvas.width;
  const height = canvas.height;

  // ---- Lanes ----------------------------------------------------
  const laneCount = 3;
  const lanePositions = [width * 0.25, width * 0.5, width * 0.75];
  const laneWidth = width * 0.24;

  // ---- Charaktere ----------------------------------------------
  const CHARACTERS = [
    { name: "Leni", bodyColor: "#7cf5ff", accentColor: "#ffffff" },
    { name: "Nico", bodyColor: "#57ffb3", accentColor: "#021018" },
    { name: "Sam", bodyColor: "#ffdd73", accentColor: "#3b2b00" },
    { name: "Keller", bodyColor: "#ff7cc3", accentColor: "#2b0016" },
  ];
  let currentCharacterIndex = 0;

  // ---- Büro-Hindernisse ----------------------------------------
  const OBSTACLE_TYPES = [
    {
      key: "monitor",
      width: 70,
      height: 50,
      color: "#1c2440",
      detail: "#c8e0ff",
    },
    {
      key: "chair",
      width: 60,
      height: 70,
      color: "#222b46",
      detail: "#4b5b9a",
    },
    {
      key: "files",
      width: 65,
      height: 55,
      color: "#2b324d",
      detail: "#9ad0ff",
    },
    {
      key: "coffee",
      width: 45,
      height: 50,
      color: "#f5f5f5",
      detail: "#c07b3f",
    },
  ];

  // ---- Game State ----------------------------------------------
  let laneIndex = 1; // 0 = links, 1 = mitte, 2 = rechts
  const obstacles = [];
  let running = false;
  let lastTime = 0;
  let obstacleTimer = 0;
  let obstacleInterval = 1.0; // Sekunden
  let speed = 260; // px / s
  let score = 0;
  let lives = 3;
  let elapsedTime = 0;
  let invulTime = 0;

  function updateHUD() {
    scoreEl.textContent = `Score: ${Math.floor(score)}`;
    livesEl.textContent = `Leben: ${lives}`;
    timeEl.textContent = `Zeit: ${Math.floor(elapsedTime)}s`;
  }

  function resetGameState() {
    laneIndex = 1;
    obstacles.length = 0;
    running = true;
    lastTime = 0;
    obstacleTimer = 0;
    obstacleInterval = 1.0;
    speed = 260;
    score = 0;
    lives = 3;
    elapsedTime = 0;
    invulTime = 0;
    updateHUD();
  }

  function getLaneX(lane) {
    return lanePositions[lane];
  }

  function getPlayerRect() {
    const w = 64;
    const h = 86;
    const x = getLaneX(laneIndex) - w / 2;
    const y = height - h - 36;
    return { x, y, width: w, height: h };
  }

  function getObstacleRect(o) {
    const w = o.width;
    const h = o.height;
    const x = getLaneX(o.lane) - w / 2;
    const y = o.y;
    return { x, y, width: w, height: h };
  }

  function rectsOverlap(a, b) {
    return !(
      a.x + a.width < b.x ||
      a.x > b.x + b.width ||
      a.y + a.height < b.y ||
      a.y > b.y + b.height
    );
  }

  function spawnObstacle() {
    const lane = Math.floor(Math.random() * laneCount);
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];

    obstacles.push({
      lane,
      y: -80,
      width: type.width,
      height: type.height,
      type: type.key,
    });
  }

  function update(dt) {
    if (!running) return;

    elapsedTime += dt;
    score += dt * 60;
    speed += dt * 6; // langsam schneller
    obstacleTimer += dt;

    if (obstacleTimer >= obstacleInterval) {
      obstacleTimer = 0;
      spawnObstacle();

      // alle ~20s Spawns etwas dichter
      if (obstacleInterval > 0.55 && elapsedTime % 20 < dt) {
        obstacleInterval -= 0.05;
      }
    }

    for (const o of obstacles) {
      o.y += speed * dt;
    }

    // Offscreen-Obstacles entfernen
    while (obstacles.length && obstacles[0].y > height + 80) {
      obstacles.shift();
    }

    // Kollisionen
    if (invulTime > 0) {
      invulTime -= dt;
    }

    if (invulTime <= 0) {
      const playerRect = getPlayerRect();
      for (const o of obstacles) {
        const oRect = getObstacleRect(o);
        if (rectsOverlap(playerRect, oRect)) {
          lives -= 1;
          invulTime = 1.2; // 1.2s unverwundbar
          if (lives <= 0) {
            gameOver();
          }
          break;
        }
      }
    }

    updateHUD();
  }

  // --- Büro-Hintergrund zeichnen --------------------------------
  function drawOfficeBackground() {
    // Wand-Gradient
    const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
    wallGrad.addColorStop(0, "#071021");
    wallGrad.addColorStop(0.35, "#050a16");
    wallGrad.addColorStop(1, "#02040b");
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, width, height);

    // Bodenlicht vorne
    const floorGrad = ctx.createRadialGradient(
      width / 2,
      height * 0.95,
      40,
      width / 2,
      height,
      height * 0.7
    );
    floorGrad.addColorStop(0, "rgba(0, 215, 255, 0.35)");
    floorGrad.addColorStop(1, "rgba(0, 215, 255, 0)");
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.ellipse(width / 2, height * 0.98, width * 0.6, height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // dezente Schränke links / rechts
    ctx.fillStyle = "rgba(8, 16, 40, 0.8)";
    const cabinetW = 90;
    const cabinetH = 220;
    ctx.fillRect(32, height * 0.45, cabinetW, cabinetH);
    ctx.fillRect(width - 32 - cabinetW, height * 0.45, cabinetW, cabinetH);

    ctx.fillStyle = "rgba(35, 48, 90, 0.65)";
    for (let i = 0; i < 4; i++) {
      const y = height * 0.46 + i * 48;
      ctx.fillRect(40, y, cabinetW - 16, 30);
      ctx.fillRect(width - 40 - (cabinetW - 16), y, cabinetW - 16, 30);
    }
  }

  // --- Lanes & Bodenzeichnen ------------------------------------
  function drawLanes() {
    for (let i = 0; i < laneCount; i++) {
      const x = lanePositions[i] - laneWidth / 2;
      const laneColor = i === 1 ? "#111a2f" : "#090f21";
      ctx.fillStyle = laneColor;
      ctx.fillRect(x, 60, laneWidth, height - 120);

      // Leichte Rand-Beleuchtung
      const edgeGrad = ctx.createLinearGradient(x, 0, x + laneWidth, 0);
      edgeGrad.addColorStop(0, "rgba(0, 220, 255, 0.1)");
      edgeGrad.addColorStop(0.5, "rgba(0, 220, 255, 0)");
      edgeGrad.addColorStop(1, "rgba(0, 220, 255, 0.1)");
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(x, 60, laneWidth, height - 120);

      // „Teppich“-Muster / Hilfslinien (scrollen mit Zeit)
      const offset = (elapsedTime * 120) % 40;
      ctx.strokeStyle = "rgba(120, 153, 255, 0.18)";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      for (let y = 60 - offset; y < height - 60; y += 40) {
        ctx.beginPath();
        ctx.moveTo(x + laneWidth * 0.2, y);
        ctx.lineTo(x + laneWidth * 0.8, y + 8);
        ctx.stroke();
      }

      // Mittellinie leicht
      ctx.strokeStyle = "rgba(170, 195, 255, 0.28)";
      ctx.setLineDash([10, 14]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lanePositions[i], 70);
      ctx.lineTo(lanePositions[i], height - 70);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // --- Obstacles zeichnen ---------------------------------------
  function drawMonitor(r) {
    ctx.fillStyle = "#111727";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.fillStyle = "#c8e0ff";
    ctx.fillRect(r.x + 6, r.y + 6, r.width - 12, r.height - 18);
    ctx.fillStyle = "#111727";
    ctx.fillRect(r.x + r.width * 0.35, r.y + r.height - 10, r.width * 0.3, 6);
  }

  function drawChair(r) {
    ctx.fillStyle = "#222b46";
    ctx.fillRect(r.x + 8, r.y + 14, r.width - 16, r.height - 24); // Lehne + Sitz
    ctx.fillStyle = "#4b5b9a";
    ctx.fillRect(r.x + 10, r.y + 18, r.width - 20, (r.height - 30) * 0.5);
    ctx.fillRect(r.x + 10, r.y + (r.height - 30) * 0.5 + 18, r.width - 20, 10);
    ctx.fillStyle = "#222b46";
    ctx.fillRect(r.x + r.width / 2 - 4, r.y + r.height - 16, 8, 12);
  }

  function drawFiles(r) {
    const count = 3;
    const step = (r.width - 10) / count;
    for (let i = 0; i < count; i++) {
      const x = r.x + 5 + i * step;
      ctx.fillStyle = i === 1 ? "#9ad0ff" : "#ffd48a";
      ctx.fillRect(x, r.y + 8, step - 6, r.height - 16);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(x + 4, r.y + 14, step - 14, 6);
    }
  }

  function drawCoffee(r) {
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(r.x + 8, r.y + 16, r.width - 16, r.height - 24);
    ctx.strokeStyle = "#f5f5f5";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(r.x + r.width - 6, r.y + r.height * 0.5, 8, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    ctx.fillStyle = "#c07b3f";
    ctx.fillRect(r.x + 10, r.y + 18, r.width - 20, 10);

    // kleiner Steam
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x + r.width * 0.4, r.y + 10);
    ctx.bezierCurveTo(
      r.x + r.width * 0.35,
      r.y,
      r.x + r.width * 0.45,
      r.y - 8,
      r.x + r.width * 0.4,
      r.y - 16
    );
    ctx.stroke();
  }

  function drawObstacle(o) {
    const r = getObstacleRect(o);
    const t = o.type;
    if (t === "monitor") return drawMonitor(r);
    if (t === "chair") return drawChair(r);
    if (t === "files") return drawFiles(r);
    if (t === "coffee") return drawCoffee(r);

    // Fallback (sollte eigentlich nie passieren)
    ctx.fillStyle = "#e5ecff";
    ctx.fillRect(r.x, r.y, r.width, r.height);
  }

  // --- Player zeichnen ------------------------------------------
  function drawPlayer() {
    const p = getPlayerRect();
    const char = CHARACTERS[currentCharacterIndex];

    // Blinken bei Schaden
    if (invulTime > 0 && Math.floor(invulTime * 10) % 2 === 0) {
      return;
    }

    // Körper (Bürogummi)
    ctx.fillStyle = char.bodyColor;
    ctx.roundRect
      ? ctx.roundRect(p.x, p.y, p.width, p.height, 12)
      : ctx.fillRect(p.x, p.y, p.width, p.height);
    if (!ctx.roundRect) ctx.fill();

    // Kopf
    const headH = p.height * 0.28;
    const headY = p.y - headH + 10;
    const headX = p.x + p.width * 0.2;
    const headW = p.width * 0.6;

    ctx.fillStyle = char.accentColor;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(headX, headY, headW, headH, 10)
      : ctx.rect(headX, headY, headW, headH);
    ctx.fill();

    // Gesicht
    const eyeY = headY + headH * 0.45;
    ctx.fillStyle = "#132034";
    ctx.beginPath();
    ctx.arc(headX + headW * 0.25, eyeY, 3, 0, Math.PI * 2);
    ctx.arc(headX + headW * 0.75, eyeY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Bauchstreifen / Badge
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(p.x + p.width * 0.22, p.y + p.height * 0.35, p.width * 0.56, 11);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(p.x + p.width * 0.24, p.y + p.height * 0.36, 14, 9);

    // Glow unter dem Player
    const gradient = ctx.createRadialGradient(
      p.x + p.width / 2,
      p.y + p.height,
      10,
      p.x + p.width / 2,
      p.y + p.height + 40,
      80
    );
    gradient.addColorStop(0, "rgba(0, 209, 255, 0.7)");
    gradient.addColorStop(1, "rgba(0, 209, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(
      p.x + p.width / 2,
      p.y + p.height + 30,
      64,
      22,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // --- Gesamtes Zeichnen ----------------------------------------
  function draw() {
    drawOfficeBackground();
    drawLanes();

    // Obstacles
    for (const o of obstacles) {
      drawObstacle(o);
    }

    // Player
    drawPlayer();
  }

  // --- Game Loop -----------------------------------------------
  function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (running) {
      update(dt);
    }

    draw();
    requestAnimationFrame(loop);
  }

  function startGame() {
    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    resetGameState();
  }

  function gameOver() {
    running = false;
    finalScoreEl.textContent = Math.floor(score);
    gameOverScreen.classList.remove("hidden");
  }

  // ---- Input ---------------------------------------------------

  function handleKeyDown(event) {
    const key = event.key;
    if (key === "ArrowLeft" || key === "a" || key === "A") {
      if (laneIndex > 0) laneIndex -= 1;
    } else if (key === "ArrowRight" || key === "d" || key === "D") {
      if (laneIndex < laneCount - 1) laneIndex += 1;
    } else if (key === " " || key === "Enter") {
      if (!running) startGame();
    }
  }

  document.addEventListener("keydown", handleKeyDown);

  // Charakter-Buttons
  charButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      charButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const idx = Number(btn.dataset.character);
      if (!Number.isNaN(idx)) currentCharacterIndex = idx;
    });
  });

  // Buttons
  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  // Startzustand
  updateHUD();
  requestAnimationFrame(loop);
});
