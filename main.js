"use strict";

// DOM references
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const timeEl = document.getElementById("time");
const overlay = document.getElementById("overlay");
const finalScore = document.getElementById("final-score");
const finalTime = document.getElementById("final-time");
const restartBtn = document.getElementById("restart");
const characterButtons = document.querySelectorAll(".character-select button");

// World description
const lanes = [-1, 0, 1];
const projection = {
  vanishingX: canvas.width / 2,
  vanishingY: 70,
  bottomY: canvas.height - 80,
  laneTopOffset: 40,
  laneBottomOffset: 150,
};

// Charaktere mit eindeutigen Looks
const characters = [
  {
    id: "leni",
    label: "Leni – Lernende Verwaltung",
    bodyColor: "#2dd4bf",
    accentColor: "#a7f3d0",
    headColor: "#e0f2fe",
    outlineColor: "#0f172a",
  },
  {
    id: "nico",
    label: "Nico – IT-Nerd",
    bodyColor: "#8b5cf6",
    accentColor: "#7fff8f",
    headColor: "#ede9fe",
    outlineColor: "#1e1b4b",
  },
  {
    id: "sam",
    label: "Sam – Hauswart",
    bodyColor: "#f97316",
    accentColor: "#fed7aa",
    headColor: "#ffedd5",
    outlineColor: "#7c2d12",
  },
  {
    id: "keller",
    label: "Keller – Klassischer Bürogummi",
    bodyColor: "#1d4ed8",
    accentColor: "#e5e7eb",
    headColor: "#e0f2fe",
    outlineColor: "#0b1a3d",
  },
];

const player = {
  lane: 0,
  width: 70,
  height: 110,
};

// Game state
let obstacles = [];
let lives = 3;
let score = 0;
let timeSurvived = 0;
let spawnTimer = 0;
let running = true;
let lastTime = performance.now();
let currentCharacterIndex = 3;

characterButtons.forEach((btn, index) => {
  if (characters[index]) {
    btn.textContent = characters[index].label;
    btn.dataset.character = String(index);
  }
});

const obstacleTypes = [
  { key: "chair", baseSize: 110, color: "#c084fc", label: "Bürostuhl" },
  { key: "monitor", baseSize: 115, color: "#22c55e", label: "PC" },
  { key: "lamp", baseSize: 105, color: "#fbbf24", label: "Lampe" },
  { key: "folder", baseSize: 95, color: "#f97316", label: "Aktendossier" },
  { key: "papers", baseSize: 90, color: "#e2e8f0", label: "Papierstapel" },
];

const eraser = { key: "eraser", baseSize: 120, color: "#ef4444", label: "Wotsch en Bürogummi si?" };

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function projectToLane(lane, t) {
  // Pseudo-3D: interpolate lane center and lane width between a top vanishing point and the bottom of the road.
  // Each object stores a depth factor t (0 = weit oben/klein, 1 = beim Spieler/unten). We linearly blend position and scale to fake perspective.
  const x = lerp(projection.vanishingX + projection.laneTopOffset * lane, projection.vanishingX + projection.laneBottomOffset * lane, t);
  const y = lerp(projection.vanishingY, projection.bottomY, t);
  const scale = lerp(0.32, 1.05, t);
  return { x, y, scale };
}

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

  for (let i = 0; i < lanes.length; i++) {
    const lane = lanes[i];
    const topLeft = projectToLane(lane - 0.5, 0);
    const topRight = projectToLane(lane + 0.5, 0);
    const bottomLeft = projectToLane(lane - 0.5, 1);
    const bottomRight = projectToLane(lane + 0.5, 1);

    const gradient = ctx.createLinearGradient(0, topLeft.y, 0, bottomLeft.y);
    gradient.addColorStop(0, "rgba(255,255,255,0.04)");
    gradient.addColorStop(1, "rgba(255,255,255,0.02)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    const top = projectToLane(i, 0);
    const bottom = projectToLane(i, 1);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  const char = characters[currentCharacterIndex];
  const foot = projectToLane(player.lane, 1);
  const bodyWidth = player.width;
  const bodyHeight = player.height - 26;
  const headSize = 28;
  const bodyX = foot.x - bodyWidth / 2;
  const bodyY = foot.y - bodyHeight;
  const headX = foot.x - headSize / 2;
  const headY = bodyY - headSize + 8;

  const drawHead = () => {
    ctx.fillStyle = char.headColor;
    ctx.strokeStyle = char.outlineColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.rect(headX, headY, headSize, headSize);
    ctx.fill();
    ctx.stroke();
  };

  ctx.save();
  ctx.shadowColor = `${char.bodyColor}66`;
  ctx.shadowBlur = 14;

  if (char.id === "leni") {
    ctx.fillStyle = char.bodyColor;
    ctx.strokeStyle = char.outlineColor;
    ctx.lineWidth = 3.5;
    ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
    ctx.strokeRect(bodyX, bodyY, bodyWidth, bodyHeight);

    ctx.fillStyle = char.accentColor;
    ctx.fillRect(foot.x - bodyWidth * 0.2, bodyY + bodyHeight * 0.45, bodyWidth * 0.4, bodyHeight * 0.12);
    drawHead();
  } else if (char.id === "nico") {
    ctx.fillStyle = char.bodyColor;
    ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);

    ctx.strokeStyle = char.accentColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(bodyX - 2, bodyY - 2, bodyWidth + 4, bodyHeight + 4);

    ctx.fillStyle = "#c7f9cc";
    ctx.fillRect(foot.x - bodyWidth * 0.2, bodyY + bodyHeight * 0.5, bodyWidth * 0.4, bodyHeight * 0.14);

    ctx.strokeStyle = char.accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(foot.x, headY - 6, headSize * 0.65, Math.PI, 0);
    ctx.stroke();
    drawHead();
  } else if (char.id === "sam") {
    ctx.fillStyle = char.bodyColor;
    ctx.strokeStyle = char.outlineColor;
    ctx.lineWidth = 3.5;
    ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
    ctx.strokeRect(bodyX, bodyY, bodyWidth, bodyHeight);

    ctx.fillStyle = char.accentColor;
    ctx.fillRect(bodyX, bodyY + bodyHeight * 0.35, bodyWidth, bodyHeight * 0.08);
    ctx.fillRect(bodyX, bodyY + bodyHeight * 0.6, bodyWidth, bodyHeight * 0.08);

    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(bodyX + bodyWidth - bodyWidth * 0.18, bodyY + bodyHeight * 0.5, bodyWidth * 0.12, bodyHeight * 0.12);
    ctx.beginPath();
    ctx.fillStyle = "#6b7280";
    ctx.arc(bodyX + bodyWidth - bodyWidth * 0.12, bodyY + bodyHeight * 0.62, bodyWidth * 0.045, 0, Math.PI * 2);
    ctx.fill();
    drawHead();
  } else {
    ctx.fillStyle = char.bodyColor;
    ctx.strokeStyle = char.outlineColor;
    ctx.lineWidth = 3.5;
    ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
    ctx.strokeRect(bodyX, bodyY, bodyWidth, bodyHeight);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight * 0.14);
    ctx.strokeStyle = char.outlineColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(foot.x, bodyY + bodyHeight * 0.14);
    ctx.lineTo(foot.x, bodyY + bodyHeight * 0.6);
    ctx.stroke();

    ctx.fillStyle = char.accentColor;
    ctx.fillRect(bodyX + bodyWidth - bodyWidth * 0.18, bodyY + bodyHeight * 0.35, bodyWidth * 0.12, bodyHeight * 0.28);
    drawHead();
  }

  ctx.restore();
}

function drawChair(center, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(center.x - size * 0.25, center.y - size * 0.2, size * 0.5, size * 0.12);
  ctx.fillRect(center.x - size * 0.2, center.y - size * 0.45, size * 0.4, size * 0.18);
  ctx.fillRect(center.x - size * 0.04, center.y - size * 0.08, size * 0.08, size * 0.18);
  ctx.beginPath();
  ctx.moveTo(center.x - size * 0.18, center.y + size * 0.05);
  ctx.lineTo(center.x + size * 0.18, center.y + size * 0.05);
  ctx.lineTo(center.x + size * 0.28, center.y + size * 0.18);
  ctx.lineTo(center.x - size * 0.28, center.y + size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMonitor(center, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(center.x - size * 0.35, center.y - size * 0.4, size * 0.7, size * 0.45);
  ctx.fillStyle = "#0b1224";
  ctx.fillRect(center.x - size * 0.3, center.y - size * 0.35, size * 0.6, size * 0.35);
  ctx.fillStyle = color;
  ctx.fillRect(center.x - size * 0.06, center.y + size * 0.08, size * 0.12, size * 0.18);
  ctx.fillRect(center.x - size * 0.18, center.y + size * 0.22, size * 0.36, size * 0.05);
  ctx.restore();
}

function drawLamp(center, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(center.x - size * 0.05, center.y - size * 0.22, size * 0.1, size * 0.34);
  ctx.beginPath();
  ctx.moveTo(center.x - size * 0.2, center.y - size * 0.25);
  ctx.lineTo(center.x + size * 0.2, center.y - size * 0.25);
  ctx.lineTo(center.x, center.y - size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(center.x - size * 0.22, center.y + size * 0.16, size * 0.44, size * 0.08);
  ctx.restore();
}

function drawFolder(center, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(center.x - size * 0.28, center.y - size * 0.4, size * 0.56, size * 0.8);
  ctx.fillStyle = "#fcd34d";
  ctx.fillRect(center.x - size * 0.28, center.y - size * 0.4, size * 0.12, size * 0.8);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(center.x - size * 0.1, center.y - size * 0.25, size * 0.24, size * 0.12);
  ctx.restore();
}

function drawPapers(center, size) {
  ctx.save();
  ctx.fillStyle = "#e5e7eb";
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(center.x - size * 0.25, center.y - size * 0.3 + i * size * 0.06, size * 0.5, size * 0.08);
  }
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(center.x - size * 0.2, center.y - size * 0.28);
  ctx.lineTo(center.x + size * 0.2, center.y - size * 0.28);
  ctx.stroke();
  ctx.restore();
}

function drawEraser(center, size, color, label) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(center.x - size * 0.4, center.y - size * 0.18);
  ctx.lineTo(center.x + size * 0.42, center.y - size * 0.08);
  ctx.lineTo(center.x + size * 0.4, center.y + size * 0.18);
  ctx.lineTo(center.x - size * 0.42, center.y + size * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fef2f2";
  ctx.font = `${Math.max(14, size / 8)}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, center.x, center.y);
  ctx.restore();
}

function drawObstacle(ob) {
  const pos = projectToLane(ob.lane, ob.t);
  const size = ob.baseSize * pos.scale;
  const center = { x: pos.x, y: pos.y };
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 12;
  switch (ob.key) {
    case "chair":
      drawChair(center, size, ob.color);
      break;
    case "monitor":
      drawMonitor(center, size, ob.color);
      break;
    case "lamp":
      drawLamp(center, size, ob.color);
      break;
    case "folder":
      drawFolder(center, size, ob.color);
      break;
    case "papers":
      drawPapers(center, size);
      break;
    case "eraser":
      drawEraser(center, size, ob.color, ob.label);
      break;
  }
  ctx.restore();
}

function spawnObstacle(delta) {
  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const type = Math.random() < 0.2 ? eraser : obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    obstacles.push({
      lane,
      t: 0,
      key: type.key,
      baseSize: type.baseSize,
      color: type.color,
      label: type.label,
      speed: 0.45 + Math.random() * 0.12,
    });
    spawnTimer = 550 + Math.random() * 380;
  }
}

function update(delta) {
  if (!running) return;

  spawnObstacle(delta);
  timeSurvived += delta / 1000;
  score += delta * 0.08;

  obstacles.forEach((ob) => {
    ob.t += (ob.speed * delta) / 1000;
  });

  obstacles = obstacles.filter((ob) => ob.t < 1.12);

  const playerFoot = projectToLane(player.lane, 1);
  const playerBox = {
    x: playerFoot.x - player.width * 0.45,
    y: playerFoot.y - player.height,
    width: player.width * 0.9,
    height: player.height,
  };

  obstacles.forEach((ob) => {
    if (ob.lane !== player.lane || ob.t < 0.7) return;
    const pos = projectToLane(ob.lane, ob.t);
    const size = ob.baseSize * pos.scale;
    const box = {
      x: pos.x - size * 0.45,
      y: pos.y - size * 0.6,
      width: size * 0.9,
      height: size * 1.1,
    };

    const collide = box.x < playerBox.x + playerBox.width && box.x + box.width > playerBox.x && box.y < playerBox.y + playerBox.height && box.y + box.height > playerBox.y;

    if (collide) {
      lives -= 1;
      ob.t = 2;
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
  obstacles.slice().sort((a, b) => a.t - b.t).forEach(drawObstacle);
  drawPlayer();
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

characterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    characterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentCharacterIndex = Number(btn.dataset.character);
  });
});

restartBtn.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(loop);

