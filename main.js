"use strict";

// --- Konfiguration ---------------------------------------------------------

const LANE_WIDTH = 1.6;
const LANE_POSITIONS = [-LANE_WIDTH, 0, LANE_WIDTH];
const RUN_SPEED = 18;
const SPAWN_INTERVAL = 0.9; // Sekunden zwischen Hindernissen

const CHARACTERS = {
  leni: { body: 0x4f46e5, accent: 0xa855f7 },
  nico: { body: 0x0ea5e9, accent: 0x22c55e },
  sam: { body: 0x22c55e, accent: 0xeab308 },
  keller: { body: 0xf97316, accent: 0x38bdf8 }
};

const OBSTACLE_TYPES = [
  { key: "paper", color: 0xe5e7eb, size: [1.2, 0.5, 0.8] }, // Papierhaufen
  { key: "monitor", color: 0x38bdf8, size: [1.0, 0.8, 0.4] }, // Bildschirm
  { key: "box", color: 0xfacc15, size: [1.0, 0.9, 0.9] },    // Archivbox
  { key: "plant", color: 0x22c55e, size: [0.8, 1.2, 0.8] }   // Büropflanze
];

// --- DOM-Referenzen --------------------------------------------------------

let canvas;
let scoreEl;
let livesEl;
let timeEl;
let startScreen;
let gameOverScreen;
let startButton;
let restartButton;
let gameOverScoreEl;
let characterButtons;

// --- Three.js / Spielzustand ----------------------------------------------

let scene;
let camera;
let renderer;
let clock;

let player = null;
let activeCharacter = "leni";

let obstacles = [];
let running = false;

let score = 0;
let lives = 3;
let elapsedTime = 0;
let spawnTimer = 0;

// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("game");
  scoreEl = document.getElementById("score");
  livesEl = document.getElementById("lives");
  timeEl = document.getElementById("time");
  startScreen = document.getElementById("start-screen");
  gameOverScreen = document.getElementById("game-over");
  startButton = document.getElementById("start-button");
  restartButton = document.getElementById("restart-button");
  gameOverScoreEl = document.getElementById("game-over-score");
  characterButtons = document.querySelectorAll(".char-button");

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);
  document.addEventListener("keydown", handleKey);

  characterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.character;
      if (!key) return;
      setCharacter(key);
    });
  });

  initThree();
  resetGame();
  animate();
});

// --- Initialisierung Three.js ---------------------------------------------

function initThree() {
  if (!window.THREE) {
    console.error("THREE.js nicht geladen – prüfe js/three.min.js");
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);

  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 100);
  camera.position.set(0, 3.2, 8);
  camera.lookAt(0, 1.4, 0);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  clock = new THREE.Clock();

  addLights();
  buildEnvironment();
  createPlayer();

  window.addEventListener("resize", onWindowResize);
}

function addLights() {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x0f172a, 1.0);
  hemi.position.set(0, 8, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.4);
  dir.position.set(3, 6, 5);
  scene.add(dir);
}

function buildEnvironment() {
  const group = new THREE.Group();

  const corridorLength = 120;

  // Boden
  const floorGeom = new THREE.PlaneGeometry(6, corridorLength, 1, 40);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x020617 });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -corridorLength / 2;
  group.add(floor);

  // Fahrbahnmarkierungen
  const stripeGeom = new THREE.BoxGeometry(0.05, 0.01, 1.5);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x1f2937 });
  for (let laneIdx = 0; laneIdx < LANE_POSITIONS.length; laneIdx++) {
    if (laneIdx === 1) continue; // Linien zwischen den Spuren
    const x = (LANE_POSITIONS[laneIdx] + LANE_POSITIONS[1]) / 2;
    for (let i = 0; i < 30; i++) {
      const stripe = new THREE.Mesh(stripeGeom, stripeMat);
      stripe.position.set(x, 0.01, -i * 4);
      group.add(stripe);
    }
  }

  // Seitenwände (leicht leuchtender Büroflur)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x020617 });
  const wallGeom = new THREE.BoxGeometry(0.25, 2.4, 4);
  for (let i = 0; i < 30; i++) {
    const z = -i * 4;

    const left = new THREE.Mesh(wallGeom, wallMat);
    left.position.set(LANE_POSITIONS[0] - LANE_WIDTH, 1.2, z);
    group.add(left);

    const right = new THREE.Mesh(wallGeom, wallMat);
    right.position.set(LANE_POSITIONS[2] + LANE_WIDTH, 1.2, z);
    group.add(right);
  }

  scene.add(group);
}

// --- Spieler / Charakter ---------------------------------------------------

function createPlayer() {
  if (!scene) return;

  if (player) {
    scene.remove(player);
    player = null;
  }

  const cfg = CHARACTERS[activeCharacter] || CHARACTERS.leni;

  const group = new THREE.Group();

  const bodyGeom = new THREE.BoxGeometry(0.9, 1.4, 0.7);
  const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.body });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.y = 1.0;
  group.add(body);

  const headGeom = new THREE.SphereGeometry(0.35, 20, 20);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff3e0 });
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.y = 1.9;
  group.add(head);

  const badgeGeom = new THREE.BoxGeometry(0.35, 0.25, 0.05);
  const badgeMat = new THREE.MeshStandardMaterial({ color: cfg.accent });
  const badge = new THREE.Mesh(badgeGeom, badgeMat);
  badge.position.set(0.25, 1.05, 0.36);
  group.add(badge);

  group.position.set(0, 0, 0);
  group.userData.laneIndex = 1; // Mitte
  scene.add(group);
  player = group;
}

function setCharacter(key) {
  activeCharacter = key;
  characterButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.character === key);
  });
  createPlayer();
}

// --- Hindernisse -----------------------------------------------------------

function createObstacleMesh(config) {
  const [w, h, d] = config.size;
  const geom = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color: config.color });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.size = { x: w, y: h, z: d };
  return mesh;
}

function spawnObstacle() {
  const laneIndex = Math.floor(Math.random() * LANE_POSITIONS.length);
  const laneX = LANE_POSITIONS[laneIndex];
  const cfg = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];

  const mesh = createObstacleMesh(cfg);
  mesh.position.set(laneX, cfg.size[1] / 2, -50);
  mesh.userData.laneIndex = laneIndex;
  scene.add(mesh);
  obstacles.push(mesh);
}

function checkCollision(ob) {
  if (!player) return false;
  if (ob.userData.laneIndex !== player.userData.laneIndex) return false;

  const dz = Math.abs(ob.position.z - player.position.z);
  const limit = (ob.userData.size.z / 2) + 0.6;
  return dz < limit;
}

// --- Spiel-Update / HUD ----------------------------------------------------

function updateWorld(delta) {
  elapsedTime += delta;
  spawnTimer += delta;

  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnObstacle();
    spawnTimer = 0;
  }

  const removeList = [];

  obstacles.forEach((ob) => {
    ob.position.z += RUN_SPEED * delta;

    if (ob.position.z > 3.5) {
      removeList.push(ob);
      score += 10;
      return;
    }

    if (checkCollision(ob)) {
      removeList.push(ob);
      handleHit();
    }
  });

  removeList.forEach((ob) => {
    const idx = obstacles.indexOf(ob);
    if (idx !== -1) obstacles.splice(idx, 1);
    scene.remove(ob);
  });

  updateHud();
}

function handleHit() {
  lives -= 1;
  if (lives <= 0) {
    gameOver();
  }
}

function gameOver() {
  running = false;
  gameOverScoreEl.textContent = String(score);
  gameOverScreen.classList.remove("hidden");
}

function updateHud() {
  if (scoreEl) scoreEl.textContent = String(score);
  if (livesEl) livesEl.textContent = String(lives);
  if (timeEl) timeEl.textContent = Math.floor(elapsedTime) + "s";
}

// --- Steuerung / Game-Flow -------------------------------------------------

function resetGame() {
  score = 0;
  lives = 3;
  elapsedTime = 0;
  spawnTimer = 0;

  obstacles.forEach((ob) => scene.remove(ob));
  obstacles = [];

  if (!player) {
    createPlayer();
  }
  if (player) {
    player.position.set(0, 0, 0);
    player.userData.laneIndex = 1;
  }

  updateHud();
}

function startGame() {
  if (!scene) {
    initThree();
  }
  resetGame();
  running = true;
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
}

function handleKey(e) {
  if (!running || !player) return;

  if (e.code === "ArrowLeft" || e.code === "KeyA") {
    moveLane(-1);
  } else if (e.code === "ArrowRight" || e.code === "KeyD") {
    moveLane(1);
  }
}

function moveLane(delta) {
  let idx = player.userData.laneIndex + delta;
  idx = Math.max(0, Math.min(2, idx));
  player.userData.laneIndex = idx;
  const targetX = LANE_POSITIONS[idx];
  player.position.x = targetX;
}

// --- Animation / Resize ----------------------------------------------------

function animate() {
  requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;
  const delta = clock ? clock.getDelta() : 0;
  if (running) {
    updateWorld(delta);
  }
  renderer.render(scene, camera);
}

function onWindowResize() {
  if (!camera || !renderer) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
