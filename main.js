// Bürogummi Run – einfache stabile 3D-Version mit Three.js
// 3 Spuren, Hindernisse, Score/Leben/Zeit + Charakterauswahl

(function () {
  // ---------- DOM-Elemente ----------
  const canvas = document.getElementById("game");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const timeEl = document.getElementById("time");
  const startScreen = document.getElementById("start-screen");
  const startButton = document.getElementById("start-button");
  const characterButtons = document.querySelectorAll("[data-character]");

  // Wenn das Canvas fehlt, macht der Rest keinen Sinn
  if (!canvas) {
    console.error("Canvas #game nicht gefunden – checke index.html");
    return;
  }

  // ---------- Spielzustand ----------
  const laneWidth = 1.6;
  const lanesX = [-laneWidth, 0, laneWidth];

  let scene = null;
  let camera = null;
  let renderer = null;
  let player = null;

  let laneIndex = 1; // Mitte
  let obstacles = [];

  let running = false;
  let score = 0;
  let lives = 3;
  let elapsed = 0;
  let lastTime = performance.now();
  let loopStarted = false;

  const CHARACTERS = [
    { body: 0x38bdf8, accent: 0xffffff }, // Leni
    { body: 0xfacc15, accent: 0x111827 }, // Nico
    { body: 0x4ade80, accent: 0x064e3b }, // Sam
    { body: 0x60a5fa, accent: 0x1e3a8a }  // Keller
  ];
  let currentCharacter = 0;

  // ---------- Initialisierung ----------
  function init() {
    initUI();
    initThree();
    updateHUD();
    startLoop();
  }

  function initThree() {
    if (typeof THREE === "undefined") {
      console.error(
        "THREE ist nicht definiert. Ist three.min.js im gleichen Ordner wie index.html und vor main.js eingebunden?"
      );
      return; // UI funktioniert trotzdem, aber kein 3D-Spiel
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);

    const width = canvas.clientWidth || 900;
    const height = canvas.clientHeight || 600;

    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 2.8, 7);
    camera.lookAt(0, 1.2, -10);
    scene.add(camera);

    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambient);

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true
    });
    if (renderer.setPixelRatio) {
      renderer.setPixelRatio(window.devicePixelRatio || 1);
    }
    renderer.setSize(width, height, false);

    buildTrack();
    rebuildPlayer();
  }

  function buildTrack() {
    if (!scene || !THREE) return;

    const groundGeo = new THREE.BoxGeometry(6, 0.1, 60);
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(0, -1, -20);
    scene.add(ground);

    const stripeGeo = new THREE.BoxGeometry(0.06, 0.02, 60);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x1f2937 });

    const stripeLeft = new THREE.Mesh(stripeGeo, stripeMat);
    stripeLeft.position.set(-laneWidth, -0.95, -20);
    scene.add(stripeLeft);

    const stripeRight = new THREE.Mesh(stripeGeo, stripeMat);
    stripeRight.position.set(laneWidth, -0.95, -20);
    scene.add(stripeRight);
  }

  // ---------- Spieler ----------
  function rebuildPlayer() {
    if (!scene || typeof THREE === "undefined") return;

    if (player) {
      scene.remove(player);
      player = null;
    }

    const cfg = CHARACTERS[currentCharacter] || CHARACTERS[0];

    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(0.9, 1.2, 0.6);
    const bodyMat = new THREE.MeshBasicMaterial({ color: cfg.body });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.6, 0);
    group.add(body);

    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshBasicMaterial({ color: cfg.accent });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 1.25, 0);
    group.add(head);

    const baseGeo = new THREE.BoxGeometry(1.1, 0.1, 0.8);
    const baseMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, -0.05, 0);
    group.add(base);

    group.position.set(lanesX[laneIndex], 0, 0);
    player = group;
    scene.add(player);
  }

  function setCharacter(index) {
    if (index < 0 || index >= CHARACTERS.length) return;
    currentCharacter = index;
    characterButtons.forEach((b) => b.classList.remove("active"));
    const btn = document.querySelector(`[data-character="${index}"]`);
    if (btn) btn.classList.add("active");
    rebuildPlayer();
  }

  function moveLeft() {
    if (!running || !player) return;
    if (laneIndex > 0) {
      laneIndex--;
      player.position.x = lanesX[laneIndex];
    }
  }

  function moveRight() {
    if (!running || !player) return;
    if (laneIndex < 2) {
      laneIndex++;
      player.position.x = lanesX[laneIndex];
    }
  }

  // ---------- Hindernisse ----------
  function spawnObstacle() {
    if (!scene || typeof THREE === "undefined") return;

    const lane = Math.floor(Math.random() * 3);
    const geo = new THREE.BoxGeometry(0.9, 0.8, 0.8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x9ca3af });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(lanesX[lane], -0.6, -40);
    scene.add(mesh);
    obstacles.push({ mesh, lane });
  }

  function updateObstacles(dt) {
    const speed = 13;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.mesh.position.z += speed * dt;

      // vorbei -> Punkte
      if (o.mesh.position.z > 3) {
        if (scene) scene.remove(o.mesh);
        obstacles.splice(i, 1);
        score += 10;
        continue;
      }

      if (checkHit(o.mesh)) {
        if (scene) scene.remove(o.mesh);
        obstacles.splice(i, 1);
        onHit();
      }
    }
  }

  function checkHit(ob) {
    if (!player) return false;
    const dx = Math.abs(ob.position.x - player.position.x);
    const dz = Math.abs(ob.position.z - player.position.z);
    return dx < laneWidth * 0.5 && dz < 0.8;
  }

  function clearObstacles() {
    obstacles.forEach((o) => {
      if (scene) scene.remove(o.mesh);
    });
    obstacles = [];
  }

  // ---------- HUD & Game State ----------
  function updateHUD() {
    if (scoreEl) scoreEl.textContent = String(Math.floor(score));
    if (livesEl) livesEl.textContent = String(lives);
    if (timeEl) timeEl.textContent = `${Math.floor(elapsed)}s`;
  }

  function resetGame() {
    score = 0;
    lives = 3;
    elapsed = 0;
    laneIndex = 1;
    if (player) player.position.x = lanesX[laneIndex];
    clearObstacles();
    updateHUD();
  }

  function startGame() {
    if (!scene || !renderer || typeof THREE === "undefined") {
      console.error("Game kann nicht starten – Three.js nicht initialisiert.");
      return;
    }
    resetGame();
    running = true;
    lastTime = performance.now();
    if (startScreen) startScreen.classList.add("hidden");
  }

  function onHit() {
    lives--;
    if (lives <= 0) {
      lives = 0;
      gameOver();
    }
    updateHUD();
  }

  function gameOver() {
    running = false;
    if (startScreen) {
      startScreen.classList.remove("hidden");
      const title = startScreen.querySelector("h1");
      if (title) title.textContent = "Game Over";
      const p = startScreen.querySelector("p");
      if (p) {
        p.textContent = `Du hast ${Math.floor(
          score
        )} Punkte erreicht. Nochmal?`;
      }
      if (startButton) startButton.textContent = "Nochmal spielen";
    }
  }

  // ---------- Haupt-Loop ----------
  function startLoop() {
    if (loopStarted) return;
    loopStarted = true;
    requestAnimationFrame(loop);
  }

  function loop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if (running) {
      elapsed += dt;
      if (Math.random() < dt / 0.9) {
        spawnObstacle();
      }
      updateObstacles(dt);
      updateHUD();
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }

    requestAnimationFrame(loop);
  }

  // ---------- UI / Events ----------
  function initUI() {
    if (startButton) {
      startButton.addEventListener("click", () => {
        startGame();
      });
    }

    characterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.character || "0", 10) || 0;
        setCharacter(idx);
      });
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        moveLeft();
      } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        moveRight();
      }
    });

    // Default-Charakter aktivieren
    setCharacter(currentCharacter);
  }

  // ---------- Start direkt nach Laden von main.js ----------
  init();
})();
