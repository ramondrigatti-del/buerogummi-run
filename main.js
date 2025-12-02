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
  const laneWidth = width * 0.22;

  // ---- Charaktere ----------------------------------------------
  const CHARACTERS = [
    { name: "Leni", bodyColor: "#7cf5ff", accentColor: "#ffffff" },
    { name: "Nico", bodyColor: "#57ffb3", accentColor: "#021018" },
    { name: "Sam", bodyColor: "#ffdd73", accentColor: "#3b2b00" },
    { name: "Keller", bodyColor: "#ff7cc3", accentColor: "#2b0016" },
  ];
  let currentCharacterIndex = 0;

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
    const w = 60;
    const h = 80;
    const x = getLaneX(laneIndex) - w / 2;
    const y = height - h - 30;
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
    obstacles.push({
      lane,
      y: -40,
      width: 60,
      height: 40,
    });
  }

  function update(dt) {
    if (!running) return;

    elapsedTime += dt;
    score += dt * 50;
    speed += dt * 5; // langsam schneller
    obstacleTimer += dt;

    if (obstacleTimer >= obstacleInterval) {
      obstacleTimer = 0;
      spawnObstacle();

      // alle ~20s Spawns etwas dichter
      if (obstacleInterval > 0.5 && elapsedTime % 20 < dt) {
        obstacleInterval -= 0.05;
      }
    }

    for (const o of obstacles) {
      o.y += speed * dt;
    }

    // Offscreen-Obstacles entfernen
    while (obstacles.length && obstacles[0].y > height + 60) {
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

  function draw() {
    // Hintergrund
    ctx.fillStyle = "#020515";
    ctx.fillRect(0, 0, width, height);

    // Lanes
    for (let i = 0; i < laneCount; i++) {
      const x = lanePositions[i] - laneWidth / 2;
      const laneColor = i === 1 ? "#141d36" : "#0c1427";
      ctx.fillStyle = laneColor;
      ctx.fillRect(x, 40, laneWidth, height - 80);

      // Mittellinie
      ctx.strokeStyle = "rgba(120, 153, 255, 0.15)";
      ctx.setLineDash([10, 16]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lanePositions[i], 50);
      ctx.lineTo(lanePositions[i], height - 50);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Obstacles
    for (const o of obstacles) {
      const r = getObstacleRect(o);
      ctx.fillStyle = "#e5ecff";
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.fillStyle = "#9aa3c2";
      ctx.fillRect(r.x + 6, r.y + 10, r.width - 12, r.height - 20);
    }

    // Player
    const p = getPlayerRect();
    const char = CHARACTERS[currentCharacterIndex];

    if (!(invulTime > 0 && Math.floor(invulTime * 10) % 2 === 0)) {
      // Körper
      ctx.fillStyle = char.bodyColor;
      ctx.fillRect(p.x, p.y, p.width, p.height);

      // Kopf
      ctx.fillStyle = char.accentColor;
      const headH = p.height * 0.28;
      ctx.fillRect(
        p.x + p.width * 0.2,
        p.y - headH + 8,
        p.width * 0.6,
        headH
      );

      // Bauchstreifen
      ctx.globalAlpha = 0.7;
      ctx.fillRect(
        p.x + p.width * 0.2,
        p.y + p.height * 0.35,
        p.width * 0.6,
        10
      );
      ctx.globalAlpha = 1;
    }

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
      60,
      20,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

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
