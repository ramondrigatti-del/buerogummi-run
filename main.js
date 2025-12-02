'use strict';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// Character definitions for quick palette swaps
const characters = [
  { label: 'Leni – Lernende Verwaltung', bodyColor: '#39d6c8', accentColor: '#b9fff6', id: 'leni' },
  { label: 'Nico – IT-Nerd', bodyColor: '#6b21a8', accentColor: '#7cff8c', id: 'nico' },
  { label: 'Sam – Hauswart', bodyColor: '#f97316', accentColor: '#ffb96b', id: 'sam' },
  { label: 'Keller – Klassischer Bürogummi', bodyColor: '#1d4ed8', accentColor: '#dbeafe', id: 'keller' }
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

// Three.js setup
let scene;
let camera;
let renderer;
let ambientLight;
let dirLight;

// Game state
const laneX = [-2.4, 0, 2.4];
const laneWidth = 2.4;
const corridorLength = 120;
let player;
let obstacles = [];
let speed = 10;
let lives = 3;
let score = 0;
let elapsed = 0;
let playing = false;
let lastTime = performance.now();
let loopStarted = false;
let sceneReady = false;
let currentLaneIndex = 1;
let targetLaneIndex = 1;
const ctaMessages = [
  'Du wärst ein Top-Bürogummi – melde dich für eine Schnupperlehre bei der Gemeinde Freienbach!',
  'KV-Power gesucht! Spring bei der Gemeinde Freienbach vorbei.',
  'Tempo liegt dir? Dann passt du perfekt in unser Verwaltungsteam.'
];

// Geometry helpers
function createFloor() {
  const floor = new THREE.Group();
  const corridorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.1, roughness: 0.8 });
  const laneMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.05, roughness: 0.6 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, emissive: 0x1f2937, emissiveIntensity: 0.4 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x070c18, roughness: 1 });

  for (let i = 0; i < corridorLength / 8; i++) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(laneWidth * 3.2, 0.15, 8), corridorMat);
    slab.position.set(0, -0.15, -i * 8);
    floor.add(slab);

    const laneBand = new THREE.Mesh(new THREE.BoxGeometry(laneWidth * 3.2, 0.02, 8), laneMat);
    laneBand.position.set(0, 0.02, -i * 8 - 4);
    floor.add(laneBand);

    const divider = new THREE.Mesh(new THREE.BoxGeometry(laneWidth * 3.2, 0.01, 0.25), stripeMat);
    divider.position.set(0, 0.025, -i * 8);
    floor.add(divider);
  }

  for (let lane = -1; lane <= 1; lane++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, corridorLength), stripeMat);
    stripe.position.set(lane * laneWidth, 0.05, -corridorLength / 2);
    floor.add(stripe);
  }

for (let i = 0; i < corridorLength / 10; i++) {
  // linke Wand
  const wallLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 2.4, 10),
    wallMat
  );
  wallLeft.position.set(-laneWidth * 2, 1.2, -i * 10 - 5);

  // rechte Wand – eigene Mesh-Instanz (kein clone)
  const wallRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 2.4, 10),
    wallMat
  );
  wallRight.position.set(laneWidth * 2, 1.2, -i * 10 - 5);

  floor.add(wallLeft);
  floor.add(wallRight);
}
  scene.add(floor);
}

// Player avatar creation
function createPlayer(character) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.7), new THREE.MeshStandardMaterial({ color: character.bodyColor }));
  body.position.y = 0.7;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: character.accentColor }));
  head.position.y = 1.4;

  const detailMaterial = new THREE.MeshStandardMaterial({ color: character.accentColor });
  if (character.id === 'leni') {
    const folder = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.05), detailMaterial);
    folder.position.set(0, 0.95, 0.38);
    group.add(folder);
  }
  if (character.id === 'nico') {
    body.material = new THREE.MeshStandardMaterial({ color: character.bodyColor });
    const outline = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.45, 0.78), new THREE.MeshStandardMaterial({ color: character.accentColor }));
    outline.position.y = 0.7;
    group.add(outline);
    const laptop = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.05), detailMaterial);
    laptop.position.set(0, 0.9, 0.4);
    group.add(laptop);
  }
  if (character.id === 'sam') {
    const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.72), detailMaterial);
    stripe1.position.y = 0.95;
    const stripe2 = stripe1.clone();
    stripe2.position.y = 0.55;
    group.add(stripe1);
    group.add(stripe2);
    const keys = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.12), new THREE.MeshStandardMaterial({ color: 0xb0b5c2 }));
    keys.position.set(-0.6, 0.6, 0.3);
    group.add(keys);
  }
  if (character.id === 'keller') {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.72), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    collar.position.y = 1.35;
    group.add(collar);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.05), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    tie.position.set(0, 1, 0.35);
    group.add(tie);
    const folder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.22), new THREE.MeshStandardMaterial({ color: 0x93c5fd }));
    folder.position.set(0.62, 0.8, 0.15);
    group.add(folder);
  }

  group.add(body);
  group.add(head);
  group.position.set(0, 0, 0);
  group.userData.size = { x: 0.9, y: 1.6, z: 0.8 };
  return group;
}

// Obstacles
const obstacleTypes = [
  { key: 'chair', color: 0x7c3aed, size: [1, 1.4, 1] },
  { key: 'monitor', color: 0x38bdf8, size: [0.9, 1.1, 0.4] },
  { key: 'folder', color: 0xfcd34d, size: [0.8, 1, 0.35] },
  { key: 'paper', color: 0xe2e8f0, size: [1.2, 0.35, 0.9] },
  { key: 'eraser', color: 0xef4444, size: [1.1, 0.55, 0.7] }
];

function buildObstacleMesh(typeKey) {
  const config = obstacleTypes.find((o) => o.key === typeKey) || obstacleTypes[0];
  const [w, h, d] = config.size;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: config.color }));
  mesh.userData.size = { x: w, y: h, z: d };
  mesh.userData.type = typeKey;
  if (typeKey === 'chair') {
    const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.55, d * 0.2), new THREE.MeshStandardMaterial({ color: 0xa78bfa }));
    back.position.set(0, h * 0.4, -d * 0.35);
    mesh.add(back);
  }
  if (typeKey === 'monitor') {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.2, h * 0.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x0ea5e9 }));
    stand.position.set(0, -h * 0.2, 0);
    mesh.add(stand);
  }
  if (typeKey === 'folder') {
    mesh.rotation.y = -0.3;
  }
  if (typeKey === 'eraser') {
    const label = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.85, d * 1.02), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    label.position.set(0, 0, 0.001);
    mesh.add(label);
  }
  return mesh;
}

function spawnInitialObstacles() {
  obstacles.forEach((o) => scene.remove(o.mesh));
  obstacles = [];
  const laneTracker = [-40, -40, -40];
  for (let i = 0; i < 18; i++) {
    const lane = Math.floor(Math.random() * 3);
    const z = laneTracker[lane] - (8 + Math.random() * 8);
    laneTracker[lane] = z;
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)].key;
    const mesh = buildObstacleMesh(type);
    mesh.position.set(laneX[lane], 0, z);
    scene.add(mesh);
    obstacles.push({ mesh, lane });
  }
}

function resetGame() {
  lives = 3;
  score = 0;
  elapsed = 0;
  speed = 10;
  currentLaneIndex = 1;
  targetLaneIndex = 1;
  if (player) {
    player.position.set(laneX[1], 0, 0);
  }
  spawnInitialObstacles();
  updateHud();
}

function updateHud() {
  if (!scoreEl || !livesEl || !timeEl) return;
  scoreEl.textContent = `Score: ${Math.floor(score)}`;
  livesEl.textContent = `Leben: ${lives}`;
  timeEl.textContent = `Zeit: ${Math.floor(elapsed)}s`;
}

function updatePlayer(delta) {
  const currentX = player.position.x;
  const targetX = laneX[targetLaneIndex];
  const lerpFactor = clamp(delta * 10, 0, 1);
  player.position.x = currentX + (targetX - currentX) * lerpFactor;
}

function updateObstacles(delta) {
  const removeList = [];
  obstacles.forEach((obs, index) => {
    obs.mesh.position.z += speed * delta;
    if (obs.mesh.position.z > 5) {
      removeList.push(index);
    }
    if (checkCollision(player, obs.mesh)) {
      onHit(obs);
      removeList.push(index);
    }
  });
  removeList.reverse().forEach((idx) => {
    scene.remove(obstacles[idx].mesh);
    obstacles.splice(idx, 1);
  });
  while (obstacles.length < 18) {
    const lane = Math.floor(Math.random() * 3);
    const farthestZ = obstacles.filter((o) => o.lane === lane).reduce((m, o) => Math.min(m, o.mesh.position.z), 10);
    const spawnZ = Math.min(-30 - Math.random() * 20, farthestZ - 10);
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)].key;
    const mesh = buildObstacleMesh(type);
    mesh.position.set(laneX[lane], 0, spawnZ);
    scene.add(mesh);
    obstacles.push({ mesh, lane });
  }
}

function checkCollision(a, b) {
  const sa = a.userData.size;
  const sb = b.userData.size;
  if (!sa || !sb) return false;
  const dx = Math.abs(a.position.x - b.position.x);
  const dy = Math.abs((a.position.y + sa.y * 0.5) - (b.position.y + sb.y * 0.5));
  const dz = Math.abs(a.position.z - b.position.z);
  return dx < (sa.x + sb.x) * 0.5 && dy < (sa.y + sb.y) * 0.5 && dz < (sa.z + sb.z) * 0.5;
}

function onHit() {
  lives -= 1;
  flashPlayer();
  if (lives <= 0) {
    triggerGameOver();
  }
}

function flashPlayer() {
  player.scale.set(1.1, 1.1, 1.1);
  setTimeout(() => player.scale.set(1, 1, 1), 120);
}

function triggerGameOver() {
  playing = false;
  overlayEl.classList.remove('hidden');
  const cta = ctaMessages[Math.floor(Math.random() * ctaMessages.length)];
  ctaEl.textContent = cta;
  finalScoreEl.textContent = `Score: ${Math.floor(score)}`;
  finalTimeEl.textContent = `Zeit: ${Math.floor(elapsed)}s`;
}

function startGame() {
  if (!sceneReady) {
    initThree();
  }
  overlayEl.classList.add('hidden');
  startScreenEl.classList.add('hidden');
  resetGame();
  playing = true;
  lastTime = performance.now();
  ensureLoop();
}

function restartGame() {
  overlayEl.classList.add('hidden');
  resetGame();
  playing = true;
  lastTime = performance.now();
  ensureLoop();
}

function update(delta) {
  if (!playing) return;
  elapsed += delta;
  score += delta * 25;
  speed += delta * 0.25;
  const camTargetX = player.position.x * 0.35;
  camera.position.x += (camTargetX - camera.position.x) * 0.08;
  camera.lookAt(new THREE.Vector3(player.position.x, 1, -10));
  updatePlayer(delta);
  updateObstacles(delta);
  updateHud();
}

function render() {
  renderer.render(scene, camera);
}

function loop() {
  if (!sceneReady) return;
  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(delta);
  render();
  requestAnimationFrame(loop);
}

// Input
function bindInput() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
      targetLaneIndex = Math.max(0, targetLaneIndex - 1);
    }
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
      targetLaneIndex = Math.min(2, targetLaneIndex + 1);
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
  if (!sceneReady) return;
  scene.remove(player);
  player = createPlayer(characters[currentCharacterIndex]);
  player.position.x = laneX[currentLaneIndex];
  scene.add(player);
}

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050914);
  camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
  camera.position.set(0, 4, 8);
  camera.lookAt(new THREE.Vector3(0, 1, -10));
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  if (typeof renderer.setPixelRatio === 'function') {
    renderer.setPixelRatio(window.devicePixelRatio || 1);
  }
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  ambientLight = new THREE.AmbientLight(0xbcc3d1, 0.65);
  dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  dirLight.position.set(3, 8, 4);
  dirLight.castShadow = false;
  scene.add(ambientLight);
  scene.add(dirLight);

  createFloor();
  player = createPlayer(characters[currentCharacterIndex]);
  player.position.x = laneX[currentLaneIndex];
  scene.add(player);
  spawnInitialObstacles();
  sceneReady = true;
  resize();
}

function resize() {
  if (!renderer || !camera || !canvas) return;
  const { clientWidth, clientHeight } = canvas;
  renderer.setSize(clientWidth, clientHeight);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

function ensureLoop() {
  if (!loopStarted) {
    loopStarted = true;
    requestAnimationFrame(loop);
  }
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
  updateHud();

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', restartGame);
  window.addEventListener('resize', resize);
}

window.addEventListener('DOMContentLoaded', () => {
  initDom();
  initThree();
  ensureLoop();
});

// Commentary: PerspectiveCamera + WebGLRenderer provide the pseudo-3D depth. Obstacles advance along -Z while the camera follows
// the player laterally, giving a clear third-person lane view.
