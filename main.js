"use strict";

// ---------- Globale Variablen für das Spiel ----------

let scene, camera, renderer;
let player;
let laneIndex = 1; // 0 = links, 1 = Mitte, 2 = rechts
const laneWidth = 1.3;
const laneX = [-laneWidth, 0, laneWidth];

const obstacles = [];
const maxObstacles = 7;

let running = false;
let clock;
let elapsedTime = 0;
let score = 0;
let lives = 3;

// DOM-Elemente
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const timeEl = document.getElementById("time");
const startPanel =
  document.getElementById("start-panel") || document.querySelector(".panel");
const startButton = document.getElementById("start-button");
const characterButtons = document.querySelectorAll(".character-select button");

// Charakter-Definitionen (Farben etc.)
const CHARACTERS = [
  // 0 – Lernende Verwaltung
  { body: 0x38bdf8, accent: 0xffffff },
  // 1 – IT-Nerd
  { body: 0x8b5cf6, accent: 0x22c55e },
  // 2 – Hauswart
  { body: 0x22c55e, accent: 0xf97316 },
  // 3 – Klassischer Bürogummi
  { body: 0x0ea5e9, accent: 0xfacc15 }
];

let currentCharacterIndex = [...characterButtons].findIndex(btn =>
  btn.classList.contains("active")
);
if (currentCharacterIndex < 0) currentCharacterIndex = 0;

// ---------- Three.js Grundaufbau ----------

function initThree() {
  const canvas = document.getElementById("game");
  if (!canvas) {
    console.error("Canvas mit id='game' nicht gefunden.");
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);

  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
  camera.position.set(0, 2.3, 6);
  camera.lookAt(0, 1.3, 0);
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
  });

  // Ältere three.js-Versionen kennen setPixelRatio evtl. noch nicht
  if (renderer.setPixelRatio) {
    renderer.setPixelRatio(window.devicePixelRatio || 1);
  }
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  // Licht
  const hemi = new THREE.HemisphereLight(0xffffff, 0x020617, 0.9);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(3, 5, 2);
  scene.add(dir);

  // Boden / Gang
  buildCorridor();

  // Spielerfigur
  player = buildPlayerMesh(currentCharacterIndex);
  scene.add(player);

  clock = new THREE.Clock();
  updateHUD();
}

function buildCorridor() {
  // Boden
  const floorGeo = new THREE.PlaneGeometry(8, 40);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x020b1f });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -10;
  scene.add(floor);

  // Lane-Linien
  const lineGeo = new THREE.PlaneGeometry(0.04, 40);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const lineLeft = new THREE.Mesh(lineGeo, lineMat);
  lineLeft.rotation.x = -Math.PI / 2;
  lineLeft.position.set(-laneWidth, 0.001, -10);
  scene.add(lineLeft);

  const lineRight = lineLeft.clone();
  lineRight.position.x = laneWidth;
  scene.add(lineRight);
}

// ---------- Spieler / Charakter ----------

function buildPlayerMesh(characterIndex) {
  const cfg = CHARACTERS[characterIndex] || CHARACTERS[0];
  const bodyColor = cfg.body;
  const accentColor = cfg.accent;

  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.9, 1.2, 0.8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.8;
  group.add(body);

  const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.4;
  group.add(head);

  const badgeGeo = new THREE.BoxGeometry(0.25, 0.25, 0.05);
  const badgeMat = new THREE.MeshStandardMaterial({ color: accentColor });
  const badge = new THREE.Mesh(badgeGeo, badgeMat);
  badge.position.set(0, 0.95, 0.43);
  group.add(badge);

  group.position.set(laneX[laneIndex], 0, 0);

  // einfache Bounding-Box für Kollision
  group.userData.size = { x: 0.9, y: 1.6, z: 0.8 };

  return group;
}

function setLane(newIndex) {
  laneIndex = Math.max(0, Math.min(2, newIndex));
  if (player) {
    player.position.x = laneX[laneIndex];
  }
}

// ---------- Hindernisse ----------

const obstacleTypes = [
  { key: "chair", color: 0x7c3aed, size: [1.0, 1.1, 1.0] },
  { key: "monitor", color: 0x38bdf8, size: [0.9, 0.7, 0.3] },
  { key: "paper", color: 0xe2e8f0, size: [1.2, 0.12, 0.9] },
  { key: "eraser", color: 0xf97316, size: [0.7, 0.35, 0.4] }
];

function buildObstacleMesh(typeIndex) {
  const cfg = obstacleTypes[typeIndex] || obstacleTypes[0];
  const [w, h, d] = cfg.size;
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color: cfg.color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.size = { x: w, y: h, z: d };
  mesh.userData.type = cfg.key;
  return mesh;
}

function spawnObstacle() {
  if (!scene) return;
  if (obstacles.length >= maxObstacles) return;

  const lane = Math.floor(Math.random() * 3); // 0,1,2
  const typeIndex = Math.floor(Math.random() * obstacleTypes.length);
  const mesh = buildObstacleMesh(typeIndex);

  mesh.position.set(laneX[lane], 0.5, -20); // weit vorne im Gang
  scene.add(mesh);

  obstacles.push({
    mesh,
    lane,
    speed: 8 + Math.random() * 4
  });
}

function updateObstacles(delta) {
  if (!player) return;

  const playerSize = player.userData.size || { x: 1, y: 1.6, z: 1 };
  const playerPos = player.position;

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.mesh.position.z += o.speed * delta; // Richtung Kamera

    // raus, wenn an Kamera vorbei
    if (o.mesh.position.z > 6) {
      scene.remove(o.mesh);
      obstacles.splice(i, 1);
      continue;
    }

    // einfache AABB-Kollision
    const os = o.mesh.userData.size || { x: 1, y: 1, z: 1 };
    const dx = Math.abs(o.mesh.position.x - playerPos.x);
    const dz = Math.abs(o.mesh.position.z - playerPos.z);

    if (
      dx < (playerSize.x + os.x) * 0.5 &&
      dz < (playerSize.z + os.z) * 0.5
    ) {
      handleHit(i);
    }
  }

  // neue Hindernisse zufällig spawnen
  if (Math.random() < delta * 1.8) {
    spawnObstacle();
  }
}

function handleHit(index) {
  const o = obstacles[index];
  scene.remove(o.mesh);
  obstacles.splice(index, 1);

  lives -= 1;
  if (lives <= 0) {
    lives = 0;
    updateHUD();
    gameOver();
  } else {
    updateHUD();
  }
}

// ---------- HUD & Game-State ----------

function updateHUD() {
  if (scoreEl) scoreEl.textContent = Math.floor(score);
  if (livesEl) livesEl.textContent = lives;
  if (timeEl) timeEl.textContent = `${Math.floor(elapsedTime)}s`;
}

function resetGameState() {
  // Hindernisse entfernen
  for (const o of obstacles) {
    scene.remove(o.mesh);
  }
  obstacles.length = 0;

  laneIndex = 1;
  if (player) {
    player.position.set(laneX[laneIndex], 0, 0);
  }

  score = 0;
  lives = 3;
  elapsedTime = 0;
  updateHUD();
}

function gameOver() {
  running = false;

  if (startPanel) {
    startPanel.classList.remove("hidden");
  }
}

// ---------- Game-Loop ----------

function animate() {
  if (!running) return;

  requestAnimationFrame(animate);

  const delta = clock ? clock.getDelta() : 0.016;
  elapsedTime += delta;
  score += delta * 20;

  updateObstacles(delta);
  updateHUD();

  renderer.render(scene, camera);
}

function startGame() {
  if (!scene) {
    initThree();
  }

  resetGameState();
  running = true;

  if (startPanel) {
    startPanel.classList.add("hidden");
  }

  if (clock) {
    clock.getDelta(); // ersten grossen Delta-Sprung verhindern
  }

  animate();
}

// ---------- Input / Events ----------

// Tastatursteuerung
window.addEventListener("keydown", event => {
  if (!running) return;

  switch (event.key) {
    case "a":
    case "A":
    case "ArrowLeft":
      setLane(laneIndex - 1);
      break;
    case "d":
    case "D":
    case "ArrowRight":
      setLane(laneIndex + 1);
      break;
  }
});

// Start-Button
if (startButton) {
  startButton.addEventListener("click", () => {
    startGame();
  });
}

// Charakter-Buttons
if (characterButtons.length) {
  characterButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      characterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCharacterIndex = index;

      if (scene) {
        if (player) {
          scene.remove(player);
        }
        player = buildPlayerMesh(currentCharacterIndex);
        scene.add(player);
      }
    });
  });
}

// Szene direkt beim Laden vorbereiten,
// damit man die Figur schon hinter dem Start-Panel sieht.
window.addEventListener("load", () => {
  if (!scene) {
    initThree();
  }
});
