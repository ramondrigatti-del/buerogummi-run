"use strict";

// ---------- DOM-Elemente ----------

const canvas = document.getElementById("game");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const timeEl = document.getElementById("time");
const startBtn = document.getElementById("start-button");
const startPanel = document.querySelector(".panel");
const characterButtons = document.querySelectorAll(".character-select button");

// ---------- Three.js Basis ----------

let scene, camera, renderer;
let player;
let laneIndex = 1; // 0 = links, 1 = mitte, 2 = rechts
const laneWidth = 1.2;
const laneX = [-laneWidth, 0, laneWidth];

const obstacles = [];
const maxObstacles = 8;

let running = false;
let clock;
let elapsedTime = 0;
let score = 0;
let lives = 3;

// Charakter-Konfiguration (Farben usw.)
const CHARACTERS = {
  "0": { name: "Leni", bodyColor: 0x4ade80, accentColor: 0x22c55e },
  "1": { name: "Nico", bodyColor: 0x38bdf8, accentColor: 0x0ea5e9 },
  "2": { name: "Sam", bodyColor: 0xf97316, accentColor: 0xfdba74 },
  "3": { name: "Keller", bodyColor: 0xa855f7, accentColor: 0xc4b5fd }
};

let currentCharacter = "0";

// ---------- Setup ----------

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617); // sehr dunkles Blau

  // Kamera
  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
  camera.position.set(0, 2.2, 4.5);
  camera.lookAt(0, 1.4, -5);
  scene.add(camera);

  // Renderer nutzt das bestehende Canvas
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
  });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  // Licht
  const hemi = new THREE.HemisphereLight(0xffffff, 0x020617, 1.0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(3, 5, 2);
  scene.add(dir);

  // Boden / Gang
  buildCorridor();

  // Spieler
  player = buildPlayerMesh();
  scene.add(player);

  // Hindernisse
  createInitialObstacles();

  // Clock
  clock = new THREE.Clock();
}

function buildCorridor() {
  const floorGeo = new THREE.PlaneGeometry(6, 60);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x02091a,
    roughness: 0.8,
    metalness: 0.1
  });

  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -20;
  floor.receiveShadow = true;
  scene.add(floor);

  // seitliche Wände, damit der Gang sichtbarer ist
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x020817,
    roughness: 0.6
  });

  const wallGeo = new THREE.BoxGeometry(0.2, 2.4, 10);

  for (let i = 0; i < 6; i++) {
    // linke Wand
    const wallLeft = new THREE.Mesh(wallGeo, wallMat);
    wallLeft.position.set(-laneWidth * 2, 1.2, -i * 10 - 5);
    scene.add(wallLeft);

    // rechte Wand
    const wallRight = new THREE.Mesh(wallGeo, wallMat.clone());
    wallRight.position.set(laneWidth * 2, 1.2, -i * 10 - 5);
    scene.add(wallRight);
  }
}

// ---------- Spieler ----------

function buildPlayerMesh() {
  const cfg = CHARACTERS[currentCharacter] || CHARACTERS["0"];
  const group = new THREE.Group();

  // Körper
  const bodyGeo = new THREE.BoxGeometry(0.9, 1.4, 0.7);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: cfg.bodyColor,
    roughness: 0.4,
    metalness: 0.15
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.9;
  group.add(body);

  // Kopf
  const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.5;
  group.add(head);

  // kleines Namensbadge
  const badgeGeo = new THREE.BoxGeometry(0.35, 0.15, 0.05);
  const badgeMat = new THREE.MeshStandardMaterial({
    color: cfg.accentColor
  });
  const badge = new THREE.Mesh(badgeGeo, badgeMat);
  badge.position.set(0, 1.2, 0.35);
  group.add(badge);

  group.position.set(laneX[laneIndex], 0, 0);

  return group;
}

function rebuildPlayer() {
  if (player && scene) {
    scene.remove(player);
  }
  player = buildPlayerMesh();
  if (scene) {
    scene.add(player);
  }
}

// ---------- Hindernisse ----------

const obstacleTypes = [
  { key: "chair", color: 0x7c3aed, size: { w: 1.1, h: 1.4, d: 1.1 } },
  { key: "monitor", color: 0x38bdf8, size: { w: 0.9, h: 1.1, d: 0.4 } },
  { key: "folder", color: 0xfacc15, size: { w: 0.9, h: 1.0, d: 0.4 } },
  { key: "paper", color: 0x22c55e, size: { w: 1.2, h: 0.4, d: 0.35 } },
  { key: "eraser", color: 0xf97316, size: { w: 1.1, h: 0.55, d: 0.7 } }
];

function buildObstacleMesh(typeCfg) {
  const { w, h, d } = typeCfg.size;
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color: typeCfg.color,
    roughness: 0.6
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function createInitialObstacles() {
  obstacles.length = 0;

  for (let i = 0; i < maxObstacles; i++) {
    const typeCfg =
      obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    const mesh = buildObstacleMesh(typeCfg);
    scene.add(mesh);

    const lane = Math.floor(Math.random() * 3);
    const zPos = -10 - i * 6;

    mesh.position.set(laneX[lane], typeCfg.size.h / 2, zPos);

    obstacles.push({
      mesh,
      type: typeCfg,
      lane,
      speed: 6 + Math.random() * 3
    });
  }
}

function resetObstacle(ob) {
  const lane = Math.floor(Math.random() * 3);
  const zPos = -50 - Math.random() * 40;

  ob.lane = lane;
  ob.mesh.position.set(laneX[lane], ob.type.size.h / 2, zPos);
  ob.speed = 6 + Math.random() * 3;
}

// ---------- Game-Logik ----------

function resetGameState() {
  score = 0;
  lives = 3;
  elapsedTime = 0;
  laneIndex = 1;

  updateHUD();

  if (player) {
    player.position.set(laneX[laneIndex], 0, 0);
  }

  if (scene) {
    createInitialObstacles();
  }
}

function updateHUD() {
  if (scoreEl) scoreEl.textContent = `Score: ${Math.floor(score)}`;
  if (livesEl) livesEl.textContent = `Leben: ${lives}`;
  if (timeEl) timeEl.textContent = `Zeit: ${Math.floor(elapsedTime)}s`;
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

  clock.getDelta(); // reset
  animate();
}

function gameOver() {
  running = false;

  if (startPanel) {
    startPanel.classList.remove("hidden");
  }

  alert(
    `Game Over!\n\nScore: ${Math.floor(
      score
    )}\nZeit: ${Math.floor(elapsedTime)} Sekunden\n\nTipp: Weich den Hindernissen früher aus, um länger zu überleben.`
  );
}

function animate() {
  if (!running) return;

  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  elapsedTime += delta;
  score += delta * 15;

  updateHUD();
  updateWorld(delta);

  renderer.render(scene, camera);
}

function updateWorld(delta) {
  if (!player) return;

  obstacles.forEach((ob) => {
    ob.mesh.position.z += ob.speed * delta;

    // ausser Sicht -> nach vorne setzen
    if (ob.mesh.position.z > 4) {
      resetObstacle(ob);
    }

    // sehr einfache Kollision: gleiche Spur + z-Distanz klein
    const sameLane = ob.lane === laneIndex;
    const dz = Math.abs(ob.mesh.position.z - player.position.z);

    if (sameLane && dz < 0.9) {
      handleHit(ob);
    }
  });
}

let hitCooldown = 0;

function handleHit(obstacle) {
  // einfache Cooldown, damit man nicht in einem Frame alle Leben verliert
  const now = performance.now();
  if (now - hitCooldown < 700) return;
  hitCooldown = now;

  lives -= 1;
  updateHUD();

  // kleines optisches Feedback
  if (player) {
    player.position.y += 0.15;
    setTimeout(() => {
      if (player) player.position.y -= 0.15;
    }, 120);
  }

  resetObstacle(obstacle);

  if (lives <= 0) {
    gameOver();
  }
}

// ---------- Eingaben ----------

function handleKeyDown(e) {
  if (!running) return;

  if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
    laneIndex = Math.max(0, laneIndex - 1);
    if (player) {
      player.position.x = laneX[laneIndex];
    }
  } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
    laneIndex = Math.min(2, laneIndex + 1);
    if (player) {
      player.position.x = laneX[laneIndex];
    }
  }
}

// Charakter-Buttons

function handleCharacterClick(e) {
  const btn = e.currentTarget;
  const id = btn.getAttribute("data-character");
  if (!id) return;

  currentCharacter = id;
  // aktive Klasse updaten
  characterButtons.forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  rebuildPlayer();
}

// ---------- Initialisierung ----------

function setupUI() {
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      startGame();
    });
  }

  window.addEventListener("keydown", handleKeyDown);

  characterButtons.forEach((btn) => {
    btn.addEventListener("click", handleCharacterClick);
  });

  // Standard-Charakter aktiv markieren
  characterButtons.forEach((btn) => {
    if (btn.getAttribute("data-character") === currentCharacter) {
      btn.classList.add("active");
    }
  });

  // Anfangswerte im HUD
  updateHUD();
}

window.addEventListener("load", () => {
  // Drei.js-Setup erst, wenn wir das Spiel wirklich starten,
  // damit der Startscreen schneller lädt.
  setupUI();
});
