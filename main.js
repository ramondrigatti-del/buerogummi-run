'use strict';

// Utility helpers
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const randChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Character roster
const characters = [
  { id: 'leni', label: 'Leni – Lernende Verwaltung', body: '#2dd4bf', accent: '#b9fff6' },
  { id: 'nico', label: 'Nico – IT-Nerd', body: '#7c3aed', accent: '#7cff8c' },
  { id: 'sam', label: 'Sam – Hauswart', body: '#f97316', accent: '#ffcd86' },
  { id: 'keller', label: 'Keller – Klassischer Bürogummi', body: '#1d4ed8', accent: '#e2e8f0' }
];
let currentCharacterIndex = 3;

// DOM references
let canvas;
let scoreEl;
let livesEl;
let timeEl;
let overlayEl;
let startScreenEl;
let finalScoreEl;
let finalTimeEl;
let ctaEl;
let restartBtn;
let startBtn;
let characterButtons = [];

// Three.js objects
let scene;
let camera;
let renderer;
let clock;
let corridor;
let player;
let sceneReady = false;

// Lighting
let ambientLight;
let dirLight;

// Game state
const lanePositions = [-2.4, 0, 2.4];
const laneWidth = 2.4;
const spawnRange = { min: -80, max: -40 };
const maxObstacles = 18;
let obstacles = [];
let lastLaneSpawnZ = [spawnRange.max, spawnRange.max, spawnRange.max];
let playing = false;
let elapsed = 0;
let score = 0;
let lives = 3;
let speed = 10;
let targetLane = 1;
let loopStarted = false;

const ctaMessages = [
  'Du wärst ein Top-Bürogummi – melde dich für eine Schnupperlehre bei der Gemeinde Freienbach!',
  'KV-Power gesucht! Spring bei der Gemeinde Freienbach vorbei.',
  'Tempo liegt dir? Dann passt du perfekt in unser Verwaltungsteam.'
];

// ---------- Scene construction ----------
function buildCorridor() {
  corridor = new THREE.Group();
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8, metalness: 0.05 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xcdd5e0, roughness: 0.6, metalness: 0.02 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, emissive: 0x1f2937, emissiveIntensity: 0.35 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a1022, roughness: 1 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });

  // Floor slabs with paper-like bands
  for (let i = 0; i < 20; i++) {
    const z = -i * 6;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(laneWidth * 3.4, 0.2, 6), floorMat);
    slab.position.set(0, -0.2, z);
    corridor.add(slab);

    const paper = new THREE.Mesh(new THREE.BoxGeometry(laneWidth * 3.4, 0.06, 6), paperMat);
    paper.position.set(0, 0, z - 3);
    corridor.add(paper);
  }

  // Lane separators
  for (let lane = -1; lane <= 1; lane++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 120), stripeMat);
    stripe.position.set(lane * laneWidth, 0.05, -60);
    corridor.add(stripe);
  }

  // Side walls
  for (let i = 0; i < 12; i++) {
    const z = -i * 10 - 5;
    const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 10), wallMat);
    wallLeft.position.set(-laneWidth * 2, 1.6, z);
    const wallRight = wallLeft.clone();
    wallRight.position.x = laneWidth * 2;
    corridor.add(wallLeft, wallRight);

    const shelfL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.6, 3), shelfMat);
    shelfL.position.set(-laneWidth * 1.8, 1.3, z - 2);
    const shelfR = shelfL.clone();
    shelfR.position.x = laneWidth * 1.8;
    corridor.add(shelfL, shelfR);
  }

  scene.add(corridor);
}

function buildPlayer(character) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: character.body });
  const accentMat = new THREE.MeshStandardMaterial({ color: character.accent });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(1, 0.7, 0.8), new THREE.MeshStandardMaterial({ color: 0x0b1224 }));
  legs.position.y = 0.35;
  group.add(legs);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 0.9), bodyMat);
  body.position.y = 1.3;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), accentMat);
  head.position.y = 2.1;
  group.add(head);

  // Character-specific accents
  if (character.id === 'leni') {
    const folder = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.08), accentMat);
    folder.position.set(0.05, 1.35, 0.55);
    group.add(folder);
  } else if (character.id === 'nico') {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.6, 0.95), accentMat);
    trim.position.y = 1.3;
    group.add(trim);
    const laptop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), new THREE.MeshStandardMaterial({ color: 0xe0f2fe }));
    laptop.position.set(0, 1.25, 0.55);
    group.add(laptop);
  } else if (character.id === 'sam') {
    const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.95), accentMat);
    stripe1.position.y = 1.55;
    const stripe2 = stripe1.clone();
    stripe2.position.y = 1.1;
    group.add(stripe1, stripe2);
    const keys = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.12), new THREE.MeshStandardMaterial({ color: 0xb0b5c2 }));
    keys.position.set(-0.65, 1.1, 0.3);
    group.add(keys);
  } else if (character.id === 'keller') {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 0.95), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    collar.position.y = 2;
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.08), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    tie.position.set(0, 1.65, 0.55);
    const folder = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.24), new THREE.MeshStandardMaterial({ color: 0x93c5fd }));
    folder.position.set(0.68, 1.3, 0.2);
    group.add(collar, tie, folder);
  }

  group.position.set(lanePositions[1], 0, 0);
  group.userData.size = { x: 1, y: 2.6, z: 1 };
  return group;
}

// ---------- Obstacles ----------
const obstacleTypes = [
  { key: 'paper', color: 0xe2e8f0, size: [1.5, 0.5, 1.2] },
  { key: 'box', color: 0xa16207, size: [1.2, 1.2, 1.2] },
  { key: 'drawer', color: 0x475569, size: [1.4, 1.1, 1.1] },
  { key: 'printer', color: 0xcbd5e1, size: [1.6, 1.2, 1.1] },
  { key: 'cup', color: 0xf59e0b, size: [0.7, 0.9, 0.7] },
  { key: 'plant', color: 0x10b981, size: [1, 1.2, 1] },
  { key: 'eraser', color: 0xef4444, size: [1.2, 0.6, 0.9] }
];

function createObstacleMesh(typeKey) {
  const cfg = obstacleTypes.find((o) => o.key === typeKey) || obstacleTypes[0];
  const [w, h, d] = cfg.size;
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: cfg.color }));
  base.userData.size = { x: w, y: h, z: d };
  base.userData.type = cfg.key;

  // Add silhouettes for clarity
  if (cfg.key === 'printer') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.35, d * 0.9), new THREE.MeshStandardMaterial({ color: 0xe5e7eb }));
    top.position.y = h * 0.35;
    base.add(top);
  } else if (cfg.key === 'box') {
    const tape = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.05, d * 0.25), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
    tape.position.y = h * 0.02;
    base.add(tape);
  } else if (cfg.key === 'drawer') {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    handle.position.set(0, 0.15, d * 0.52);
    base.add(handle);
  } else if (cfg.key === 'cup') {
    const steam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    steam.position.set(0, h * 0.6, 0);
    base.add(steam);
  } else if (cfg.key === 'plant') {
    const leaves = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.5, d * 0.9), new THREE.MeshStandardMaterial({ color: 0x34d399 }));
    leaves.position.y = h * 0.5;
    base.add(leaves);
  } else if (cfg.key === 'eraser') {
    const label = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, h * 0.8, d * 1.02), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    label.position.set(0, 0, d * 0.01);
    base.add(label);
  }

  return base;
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  const minGap = 8;
  const lastZ = lastLaneSpawnZ[lane];
  const spawnZ = Math.min(spawnRange.min, lastZ - minGap - Math.random() * 6);
  lastLaneSpawnZ[lane] = spawnZ;

  const type = randChoice(obstacleTypes).key;
  const mesh = createObstacleMesh(type);
  mesh.position.set(lanePositions[lane], 0, spawnZ);
  scene.add(mesh);
  obstacles.push({ mesh, lane });
}

function spawnInitialObstacles() {
  obstacles.forEach((o) => scene.remove(o.mesh));
  obstacles = [];
  lastLaneSpawnZ = [spawnRange.max, spawnRange.max, spawnRange.max];
  for (let i = 0; i < maxObstacles; i++) {
    spawnObstacle();
  }
}

// ---------- Game flow ----------
function resetGame() {
  elapsed = 0;
  score = 0;
  lives = 3;
  speed = 10;
  targetLane = 1;
  player.position.set(lanePositions[1], 0, 0);
  spawnInitialObstacles();
  updateHud();
}

function startGame() {
  startScreenEl.classList.add('hidden');
  overlayEl.classList.add('hidden');
  resetGame();
  playing = true;
}

function triggerGameOver() {
  playing = false;
  finalScoreEl.textContent = `Score: ${Math.floor(score)}`;
  finalTimeEl.textContent = `Zeit: ${Math.floor(elapsed)}s`;
  ctaEl.textContent = randChoice(ctaMessages);
  overlayEl.classList.remove('hidden');
}

// ---------- Updates ----------
function updateHud() {
  if (!scoreEl || !livesEl || !timeEl) return;
  scoreEl.textContent = `Score: ${Math.floor(score)}`;
  livesEl.textContent = `Leben: ${lives}`;
  timeEl.textContent = `Zeit: ${Math.floor(elapsed)}s`;
}

function updatePlayer(delta) {
  const targetX = lanePositions[targetLane];
  const lerp = clamp(delta * 9, 0, 1);
  player.position.x = player.position.x + (targetX - player.position.x) * lerp;
}

function updateObstacles(delta) {
  const removal = [];
  obstacles.forEach((o, idx) => {
    o.mesh.position.z += speed * delta;
    if (o.mesh.position.z > 6) {
      removal.push(idx);
      score += 4; // knapp verpasst
    }
    if (checkCollision(player, o.mesh)) {
      onCollision(idx, removal);
    }
  });
  // remove from scene
  removal.sort((a, b) => b - a).forEach((idx) => {
    scene.remove(obstacles[idx].mesh);
    obstacles.splice(idx, 1);
  });
  while (obstacles.length < maxObstacles) {
    spawnObstacle();
  }
}

function checkCollision(a, b) {
  if (!a || !b) return false;
  const boxA = new THREE.Box3().setFromObject(a);
  const boxB = new THREE.Box3().setFromObject(b);
  return boxA.intersectsBox(boxB);
}

function onCollision(idx, removalList) {
  if (removalList.includes(idx)) return;
  lives -= 1;
  flashPlayer();
  removalList.push(idx);
  if (lives <= 0) {
    triggerGameOver();
  }
}

function flashPlayer() {
  player.traverse((child) => {
    if (child.material && child.material.color) {
      child.material.emissive = new THREE.Color(0xfff1a8);
    }
  });
  setTimeout(() => {
    player.traverse((child) => {
      if (child.material && child.material.emissive) {
        child.material.emissive.setHex(0x000000);
      }
    });
  }, 120);
}

function update(delta) {
  if (playing) {
    elapsed += delta;
    score += delta * 20;
    speed += delta * 0.25;
    updatePlayer(delta);
    updateObstacles(delta);
  }
  // Camera follows laterally
  const targetCamX = player.position.x * 0.35;
  camera.position.x += (targetCamX - camera.position.x) * 0.1;
  camera.lookAt(new THREE.Vector3(player.position.x, 1.2, -12));
  updateHud();
}

function animate() {
  const delta = clock.getDelta();
  update(delta);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---------- Input ----------
function handleLaneChange(dir) {
  targetLane = clamp(targetLane + dir, 0, 2);
}

function bindInput() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') handleLaneChange(-1);
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') handleLaneChange(1);
    if ((e.key === ' ' || e.code === 'Space') && startScreenEl && !playing && startScreenEl.classList.contains('hidden') === false) {
      startGame();
    }
  });
}

function setupCharacterButtons() {
  characterButtons.forEach((btn) => {
    const idx = Number(btn.dataset.character);
    btn.textContent = characters[idx].label;
    btn.addEventListener('click', () => {
      currentCharacterIndex = idx;
      characterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      swapPlayer();
    });
  });
}

function swapPlayer() {
  if (!scene || !player) return;
  scene.remove(player);
  player = buildPlayer(characters[currentCharacterIndex]);
  player.position.x = lanePositions[targetLane];
  scene.add(player);
}

// ---------- Initialisation ----------
function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050914);

  camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
  camera.position.set(0, 4, 10);
  camera.lookAt(new THREE.Vector3(0, 1.2, -12));

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  if (typeof renderer.setPixelRatio === 'function') {
    renderer.setPixelRatio(window.devicePixelRatio || 1);
  }
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  ambientLight = new THREE.AmbientLight(0xbcc3d1, 0.7);
  dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  dirLight.position.set(4, 8, 6);
  scene.add(ambientLight, dirLight);

  buildCorridor();
  player = buildPlayer(characters[currentCharacterIndex]);
  scene.add(player);
  spawnInitialObstacles();

  clock = new THREE.Clock();
  sceneReady = true;
}

function resize() {
  if (!renderer || !camera || !canvas) return;
  const { clientWidth, clientHeight } = canvas;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

function initDom() {
  canvas = document.getElementById('game');
  scoreEl = document.getElementById('score');
  livesEl = document.getElementById('lives');
  timeEl = document.getElementById('time');
  overlayEl = document.getElementById('overlay');
  startScreenEl = document.getElementById('start-screen');
  finalScoreEl = document.getElementById('final-score');
  finalTimeEl = document.getElementById('final-time');
  ctaEl = document.querySelector('.cta');
  restartBtn = document.getElementById('restart');
  startBtn = document.getElementById('start-button');
  characterButtons = Array.from(document.querySelectorAll('.character-select button'));

  setupCharacterButtons();
  bindInput();
  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);
  window.addEventListener('resize', resize);
}

window.addEventListener('DOMContentLoaded', () => {
  initDom();
  initThree();
  if (!loopStarted) {
    loopStarted = true;
    animate();
  }
  updateHud();
});

// Hinweis: Klassische Three.js-Initialisierung ohne Module; die Szene rendert sofort,
// die Logik (Spawns, Score, Timer) läuft nur, wenn playing=true nach Klick auf "Los geht's".
