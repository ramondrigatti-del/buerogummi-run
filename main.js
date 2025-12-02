"use strict";

// --------------------------------------------------
// DOM-Elemente
// --------------------------------------------------
const canvas = document.getElementById("game");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const timeEl = document.getElementById("time");
const startButton = document.getElementById("start-button");
const startPanel = document.getElementById("start-screen");
const characterButtons = Array.from(
  document.querySelectorAll(".character-select button")
);

// Falls etwas Wichtiges fehlt, melden wir das nur in der Konsole
if (!canvas) {
  console.error("Canvas mit id='game' nicht gefunden.");
}
if (typeof THREE === "undefined") {
  console.error("THREE ist nicht definiert. Läuft three.min.js wirklich?");
}

// --------------------------------------------------
// Spiel-State
// --------------------------------------------------
let scene, camera, renderer;
let player;

const laneWidth = 1.2;
const lanesX = [-laneWidth, 0, laneWidth];

const obstacles = [];
const maxObstacles = 8;
const obstacleSpeed = 8;       // Einheiten pro Sekunde
const spawnInterval = 1.1;     // Sekunden
let spawnTimer = 0;

let laneIndex = 1;             // 0 = links, 1 = mitte, 2 = rechts
let running = false;
let score = 0;
let lives = 3;
let elapsedTime = 0;
let lastFrameTime = null;      // für requestAnimationFrame-Delta

// Charaktere
const CHARACTER_KEYS = ["lernende", "itnerd", "hauswart", "classic"];

const CHARACTERS = {
  lernende: {
    bodyColor: 0x4f46e5,
    accentColor: 0x93c5fd
  },
  itnerd: {
    bodyColor: 0x22c55e,
    accentColor: 0xa7f3d0
  },
  hauswart: {
    bodyColor: 0xf97316,
    accentColor: 0xffedd5
  },
  classic: {
    bodyColor: 0x06b6d4,
    accentColor: 0xe0f2fe
  }
};

let currentCharacterKey = "classic";

// --------------------------------------------------
// Initialisierung Three.js
// --------------------------------------------------
function initThree() {
  if (!canvas || scene) return; // schon initialisiert oder kein Canvas

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);
  scene.fog = new THREE.Fog(0x020617, 5, 35);

  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 50);
  camera.position.set(0, 3, 7);
  camera.lookAt(0, 1.2, -5);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
  });

  if (typeof renderer.setPixelRatio === "function") {
    renderer.setPixelRatio(window.devicePixelRatio || 1);
  }
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  // Licht – nur Standard-Sachen, die in allen Versionen existieren
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 8, 5);
  scene.add(dir);

  buildFloor();

  player = buildPlayerMesh(currentCharacterKey);
  scene.add(player);

  window.addEventListener("resize", onWindowResize);
}

// Boden / Gang
function buildFloor() {
  const floorGeom = new THREE.PlaneGeometry(10, 60);
  const floorMat = new THREE.MeshPhongMaterial({
    color: 0x020617,
    shininess: 0
  });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -20;
  scene.add(floor);
}

// Spieler-Mesh
function buildPlayerMesh(characterKey) {
  const cfg = CHARACTERS[characterKey] || CHARACTERS.classic;
  const group = new THREE.Group();

  // Körper
  const bodyGeom = new THREE.BoxGeometry(0.9, 1.6, 0.8);
  const bodyMat = new THREE.MeshPhongMaterial({ color: cfg.bodyColor });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.y = 0.8;
  group.add(body);

  // Kopf
  const headGeom = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  const headMat = new THREE.MeshPhongMaterial({ color: cfg.accentColor });
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.y = 1.5;
  group.add(head);

  // kleine Akzent-Fläche vorne
  const badgeGeom = new THREE.BoxGeometry(0.3, 0.25, 0.05);
  const badgeMat = new THREE.MeshPhongMaterial({ color: cfg.accentColor });
  const badge = new THREE.Mesh(badgeGeom, badgeMat);
  badge.position.set(0, 1.1, 0.43);
  group.add(badge);

  group.position.set(lanesX[laneIndex], 0, 0);
  group.userData.radius = 0.55;

  return group;
}

// --------------------------------------------------
// Hindernisse
// --------------------------------------------------
const OBSTACLE_TYPES = [
  { color: 0x9ca3af, w: 0.9, h: 0.7, d: 0.3 }, // Bildschirm
  { color: 0xfbbf24, w: 0.7, h: 0.4, d: 0.7 }, // Papierstapel
  { color: 0x10b981, w: 0.5, h: 0.9, d: 0.5 }, // Pflanze
  { color: 0xef4444, w: 0.5, h: 0.5, d: 0.5 }  // roter Bürogummi ;)
];

function spawnObstacle() {
  if (obstacles.length >= maxObstacles) return;

  const lane = Math.floor(Math.random() * 3);
  const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];

  const geom = new THREE.BoxGeometry(type.w, type.h, type.d);
  const mat = new THREE.MeshPhongMaterial({ color: type.color });
  const mesh = new THREE.Mesh(geom, mat);

  mesh.position.set(lanesX[lane], type.h / 2, -30);
  mesh.userData.radius = Math.max(type.w, type.d) * 0.6;

  scene.add(mesh);
  obstacles.push(mesh);
}

// --------------------------------------------------
// Game-Loop & Logik
// --------------------------------------------------
function updateGame(dt) {
  elapsedTime += dt;
  spawnTimer += dt;

  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnObstacle();
  }

  const playerRadius = player ? player.userData.radius || 0.6 : 0.6;

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    ob.position.z += obstacleSpeed * dt;

    if (player) {
      const dx = ob.position.x - player.position.x;
      const dz = ob.position.z - player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const obRadius = ob.userData.radius || 0.6;

      if (dist < playerRadius + obRadius) {
        // Kollision
        scene.remove(ob);
        obstacles.splice(i, 1);
        lives -= 1;
        if (lives <= 0) {
          lives = 0;
          gameOver();
          return;
        }
        continue;
      }
    }

    // Vorbei gelaufen -> Punkte
    if (ob.position.z > 5) {
      scene.remove(ob);
      obstacles.splice(i, 1);
      score += 10;
    }
  }

  updateScoreboard();
}

function animate(timestamp) {
  if (!running) return;

  requestAnimationFrame(animate);

  if (lastFrameTime === null) {
    lastFrameTime = timestamp;
  }
  const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;

  updateGame(dt);
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// --------------------------------------------------
// UI / Steuerung
// --------------------------------------------------
function updateScoreboard() {
  if (scoreEl) scoreEl.textContent = String(Math.floor(score));
  if (livesEl) livesEl.textContent = String(lives);
  if (timeEl) timeEl.textContent = `${Math.floor(elapsedTime)}s`;
}

function resetGameState() {
  laneIndex = 1;
  score = 0;
  lives = 3;
  elapsedTime = 0;
  spawnTimer = 0;
  lastFrameTime = null;

  // Hindernisse entfernen
  for (const ob of obstacles) {
    if (scene) scene.remove(ob);
  }
  obstacles.length = 0;

  // Spieler neu bauen
  if (scene) {
    if (player) scene.remove(player);
    player = buildPlayerMesh(currentCharacterKey);
    scene.add(player);
  }

  updateScoreboard();
}

function startGame() {
  if (running) return;
  initThree();
  resetGameState();
  if (startPanel) startPanel.classList.add("hidden");
  running = true;
  requestAnimationFrame(animate);
}

function gameOver() {
  running = false;
  if (startPanel) startPanel.classList.remove("hidden");
}

function moveLane(dir) {
  if (!player) return;
  laneIndex += dir;
  if (laneIndex < 0) laneIndex = 0;
  if (laneIndex > 2) laneIndex = 2;
  player.position.x = lanesX[laneIndex];
}

function onKeyDown(e) {
  if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
    moveLane(-1);
  } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
    moveLane(1);
  } else if (e.key === "Enter" && !running) {
    startGame();
  }
}

function onWindowResize() {
  if (!renderer || !camera || !canvas) return;
  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
}

// Charakterauswahl
function updateCharacterSelection() {
  characterButtons.forEach((btn, index) => {
    const key = CHARACTER_KEYS[index];
    const active = key === currentCharacterKey;
    btn.classList.toggle("active", active);
  });

  if (scene) {
    if (player) scene.remove(player);
    player = buildPlayerMesh(currentCharacterKey);
    scene.add(player);
  }
}

// --------------------------------------------------
// Setup beim Laden
// --------------------------------------------------
function setupUI() {
  if (startButton) startButton.addEventListener("click", startGame);
  window.addEventListener("keydown", onKeyDown);

  characterButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      currentCharacterKey = CHARACTER_KEYS[index] || "classic";
      updateCharacterSelection();
    });
  });

  updateScoreboard();
}

// direkt beim Laden aufrufen (Script steht am Ende von index.html)
setupUI();
