const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const timeEl = document.getElementById("time");
const overlay = document.getElementById("overlay");
const finalScore = document.getElementById("final-score");
const finalTime = document.getElementById("final-time");
const restartBtn = document.getElementById("restart");

const lanes = [-1, 0, 1];
const laneWidth = 200;
const player = {
  lane: 0,
  y: canvas.height - 120,
  width: 80,
  height: 120,
  color: "#38bdf8",
};

let obstacles = [];
let lives = 3;
let score = 0;
let timeSurvived = 0;
let spawnTimer = 0;
let running = true;
let lastTime = performance.now();

const obstacleTypes = [
  { color: "#c084fc", label: "Bürostuhl" },
  { color: "#22c55e", label: "Lampe" },
  { color: "#fbbf24", label: "PC" },
  { color: "#f97316", label: "Aktendossier" },
  { color: "#e2e8f0", label: "Papierstapel" },
];

const eraser = { color: "#ef4444", label: "Wotsch en Bürogummi si?" };

function resetGame() {
  obstacles = [];
  lives = 3;
  score = 0;
  timeSurvived = 0;
  spawnTimer = 0;
  running = true;
  player.lane = 0;
  lastTime = performance.now();
  overlay.classList.add("hidden");
}

function drawRoad() {
  ctx.save();
  ctx.fillStyle = "#0b152c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Lanes with simple perspective
  for (let i = 0; i < lanes.length; i++) {
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    const laneCenter = canvas.width / 2 + lanes[i] * laneWidth;
    ctx.beginPath();
    ctx.moveTo(laneCenter - laneWidth / 2, 0);
    ctx.lineTo(laneCenter + laneWidth / 2, 0);
    ctx.lineTo(laneCenter + laneWidth / 2 + lanes[i] * 25, canvas.height);
    ctx.lineTo(laneCenter - laneWidth / 2 + lanes[i] * 25, canvas.height);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    const laneCenter = canvas.width / 2 + i * laneWidth;
    ctx.beginPath();
    ctx.moveTo(laneCenter - laneWidth / 2, 0);
    ctx.lineTo(laneCenter - laneWidth / 2 + i * 25, canvas.height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  const x = canvas.width / 2 + player.lane * laneWidth - player.width / 2;
  ctx.save();
  ctx.fillStyle = player.color;
  ctx.shadowColor = "rgba(56,189,248,0.6)";
  ctx.shadowBlur = 18;
  ctx.fillRect(x, player.y, player.width, player.height);
  ctx.fillStyle = "#0b1224";
  ctx.fillRect(x + 14, player.y + 20, player.width - 28, player.height - 40);
  ctx.restore();
}

function drawObstacle(ob) {
  const baseX = canvas.width / 2 + ob.lane * laneWidth;
  const perspective = 1 - (ob.y / canvas.height) * 0.35;
  const size = ob.size * perspective;
  const x = baseX - size / 2;
  const y = ob.y;

  ctx.save();
  ctx.fillStyle = ob.color;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 10;
  ctx.fillRect(x, y, size, size * 1.1);

  ctx.fillStyle = "#0b1224";
  ctx.globalAlpha = 0.2;
  ctx.fillRect(x + 6, y + 8, size - 12, size);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#e2e8f0";
  ctx.font = `${Math.max(12, size / 6)}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(ob.label, x + size / 2, y + size * 0.55);
  ctx.restore();
}

function spawnObstacle(delta) {
  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const type = Math.random() < 0.2 ? eraser : obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    obstacles.push({
      lane,
      y: -120,
      size: 120,
      color: type.color,
      label: type.label,
      speed: 280 + Math.random() * 70,
    });
    spawnTimer = 600 + Math.random() * 400;
  }
}

function update(delta) {
  if (!running) return;

  spawnObstacle(delta);
  timeSurvived += delta / 1000;
  score += delta * 0.08;

  obstacles.forEach((ob) => {
    ob.y += (ob.speed * delta) / 1000;
  });

  obstacles = obstacles.filter((ob) => ob.y < canvas.height + 80);

  obstacles.forEach((ob) => {
    if (ob.lane === player.lane && ob.y + ob.size * 0.6 >= player.y && ob.y <= player.y + player.height) {
      lives -= 1;
      ob.y = canvas.height + 100; // move off-screen
      if (lives <= 0) {
        running = false;
        showGameOver();
      }
    }
  });

  scoreEl.textContent = `Score: ${Math.floor(score)}`;
  livesEl.textContent = `Leben: ${lives}`;
  timeEl.textContent = `Zeit: ${Math.floor(timeSurvived)}s`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRoad();
  drawPlayer();
  obstacles.forEach(drawObstacle);
}

function loop(now) {
  const delta = now - lastTime;
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

function changeLane(direction) {
  if (!running) return;
  const newLaneIndex = lanes.indexOf(player.lane) + direction;
  if (newLaneIndex >= 0 && newLaneIndex < lanes.length) {
    player.lane = lanes[newLaneIndex];
  }
}

function showGameOver() {
  finalScore.textContent = `Score: ${Math.floor(score)}`;
  finalTime.textContent = `Zeit: ${Math.floor(timeSurvived)}s`;
  overlay.classList.remove("hidden");
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") changeLane(-1);
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") changeLane(1);
});

restartBtn.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(loop);

