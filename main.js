// main.js – einfache 3D-Version von "Bürogummi Run – Office Dodger"
// Voraussetzungen in index.html:
//  - <canvas id="game">
//  - <span id="score">, <span id="lives">, <span id="time">
//  - <div id="start-screen"> mit Button id="start-button"
//  - Charakterbuttons mit data-character="0..3" und Klasse "active" für den aktuellen

(function () {
  // ---- DOM-Elemente ----
  const canvas = document.getElementById("game");
  if (!canvas) {
    console.error("Canvas mit id='game' nicht gefunden.");
    return;
  }
  if (typeof THREE === "undefined") {
    console.error("THREE (three.min.js) ist nicht geladen.");
    return;
  }

  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const timeEl = document.getElementById("time");
  const hintEl = document.getElementById("hint");

  const startPanel = document.getElementById("start-screen");
  const startButton = document.getElementById("start-button");

  const characterButtons = document.querySelectorAll("[data-character]");

  // ---- Spiel-Status ----
  let scene, camera, renderer;
  let player = null;

  const laneWidth = 1.6;
  const laneX = [-laneWidth, 0, laneWidth]; // x-Positionen der 3 Spuren
  let laneIndex = 1; // 0 = links, 1 = mitte, 2 = rechts

  let obstacles = [];
  const obstacleSpeed = 11; // Bewegungsgeschwindigkeit der Hindernisse
  let spawnTimer = 0;

  let running = false;
  let score = 0;
  let lives = 3;
  let elapsedTime = 0;
  let lastTime = performance.now();
  let loopStarted = false;

  // ---- Charaktere (Farben usw.) ----
  // data-character="0" .. "3" mappen auf diese Einträge
  const CHARACTERS = [
    {
      key: "leni",
      bodyColor: 0x38bdf8, // helles blau
      accentColor: 0xffffff
    },
    {
      key: "nico",
      bodyColor: 0xfacc15, // gelb
      accentColor: 0x111827
    },
    {
      key: "sam",
      bodyColor: 0x4ade80, // grün
      accentColor: 0x064e3b
    },
    {
      key: "keller",
      bodyColor: 0x60a5fa, // klassischer bürogummi
      accentColor: 0x1e3a8a
    }
  ];

  let currentCharacterIndex = 3; // Start: klassischer Bürogummi

  // =====================================================================
  // Initialisierung
  // =====================================================================

  function init() {
    initThree();
    initUI();
    updateHud();
    startMainLoop();
  }

  function initThree() {
    // Szene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617); // sehr dunkles Blau

    // Kamera
    const aspect = canvas.clientWidth / canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 2.5, 6);
    camera.lookAt(new THREE.Vector3(0, 1.0, -10));
    scene.add(camera);

    // Sehr einfaches Licht (nur Ambient, damit es überall gleich hell ist)
    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambient);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    if (renderer.setPixelRatio) {
      renderer.setPixelRatio(window.devicePixelRatio || 1);
    }

    // Spielfeld / Korridor
    buildCorridor();

    // Spieler erstellen
    rebuildPlayer();
  }

  function buildCorridor() {
    // Boden – langer Streifen nach hinten
    const floorGeo = new THREE.BoxGeometry(6, 0.1, 60);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x0b1120 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -1, -20);
    scene.add(floor);

    // Seitliche Wände (optisch, nicht für Kollision)
    const wallGeo = new THREE.BoxGeometry(0.2, 3, 60);
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
    const wallLeft = new THREE.Mesh(wallGeo, wallMat);
    wallLeft.position.set(-3, 0.5, -20);
    scene.add(wallLeft);
    const wallRight = new THREE.Mesh(wallGeo, wallMat);
    wallRight.position.set(3, 0.5, -20);
    scene.add(wallRight);

    // Markierungen für die 3 Spuren
    const stripeGeo = new THREE.BoxGeometry(0.05, 0.01, 60);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x1f2937 });

    const stripeLeft = new THREE.Mesh(stripeGeo, stripeMat);
    stripeLeft.position.set(-laneWidth, -0.95, -20);
    scene.add(stripeLeft);

    const stripeRight = new THREE.Mesh(stripeGeo, stripeMat);
    stripeRight.position.set(laneWidth, -0.95, -20);
    scene.add(stripeRight);
  }

  // =====================================================================
  // Spieler & Charaktere
  // =====================================================================

  function rebuildPlayer() {
    if (!scene) return;

    if (player) {
      scene.remove(player);
      player = null;
    }

    const cfg =
      CHARACTERS[currentCharacterIndex] || CHARACTERS[CHARACTERS.length - 1];

    const group = new THREE.Group();

    // Körper
    const bodyGeo = new THREE.BoxGeometry(0.9, 1.2, 0.6);
    const bodyMat = new THREE.MeshBasicMaterial({ color: cfg.bodyColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.6, 0);
    group.add(body);

    // Kopf
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshBasicMaterial({ color: cfg.accentColor });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 1.25, 0);
    group.add(head);

    // Kleine "Schreibtisch"-Fläche als Base
    const baseGeo = new THREE.BoxGeometry(1.1, 0.1, 0.8);
    const baseMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, -0.05, 0);
    group.add(base);

    group.position.set(laneX[laneIndex], 0, 0);
    player = group;
    scene.add(player);
  }

  function setActiveCharacter(index) {
    if (index < 0 || index >= CHARACTERS.length) return;
    currentCharacterIndex = index;

    // Button-Styles
    characterButtons.forEach((btn) => btn.classList.remove("active"));
    const btn = document.querySelector(
      `[data-character="${String(index)}"]`
    );
    if (btn) {
      btn.classList.add("active");
    }

    rebuildPlayer();
  }

  function movePlayerLeft() {
    if (laneIndex > 0) {
      laneIndex -= 1;
      updatePlayerPosition();
    }
  }

  function movePlayerRight() {
    if (laneIndex < 2) {
      laneIndex += 1;
      updatePlayerPosition();
    }
  }

  function updatePlayerPosition() {
    if (player) {
      player.position.x = laneX[laneIndex];
    }
  }

  // =====================================================================
  // Hindernisse
  // =====================================================================

  function spawnObstacle() {
    if (!scene) return;

    const lane = Math.floor(Math.random() * 3); // 0..2
    const w = 0.9;
    const h = 0.8;
    const d = 0.8;

    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshBasicMaterial({ color: 0x9ca3af });
    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.set(laneX[lane], -0.6, -40); // weit vorne
    scene.add(mesh);

    obstacles.push({
      mesh,
      lane
    });
  }

  function updateObstacles(delta) {
    const speed = obstacleSpeed;

    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = 1.1 + Math.random() * 0.6; // Zeit bis zum nächsten Spawn
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.mesh.position.z += speed * delta;

      // zu weit hinten -> weg
      if (o.mesh.position.z > 5) {
        scene.remove(o.mesh);
        obstacles.splice(i, 1);
        continue;
      }

      // einfache Kollision
      if (checkCollision(o.mesh)) {
        scene.remove(o.mesh);
        obstacles.splice(i, 1);
        onHitObstacle();
      }
    }
  }

  function checkCollision(obMesh) {
    if (!player) return false;

    const dx = Math.abs(obMesh.position.x - player.position.x);
    const dz = Math.abs(obMesh.position.z - player.position.z);

    return dx < laneWidth * 0.5 && dz < 0.8;
  }

  function onHitObstacle() {
    lives -= 1;
    if (lives < 0) lives = 0;
    updateHud();

    if (lives <= 0) {
      gameOver();
    }
  }

  function clearObstacles() {
    obstacles.forEach((o) => {
      scene.remove(o.mesh);
    });
    obstacles = [];
  }

  // =====================================================================
  // HUD & Game State
  // =====================================================================

  function updateHud() {
    if (scoreEl) scoreEl.textContent = String(Math.floor(score));
    if (livesEl) livesEl.textContent = String(lives);
    if (timeEl) timeEl.textContent = `${Math.floor(elapsedTime)}s`;
    if (hintEl && hintEl.textContent.trim() === "") {
      hintEl.textContent = "Steuerung: A / D oder ← / →";
    }
  }

  function resetGameState() {
    score = 0;
    lives = 3;
    elapsedTime = 0;
    laneIndex = 1;
    updatePlayerPosition();
    clearObstacles();
    spawnTimer = 0;
    updateHud();
    lastTime = performance.now();
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
  }

  function gameOver() {
    running = false;

    if (startPanel) {
      startPanel.classList.remove("hidden");
      // Optional: Text anpassen, falls du im Overlay Elemente dafür hast
      const title = startPanel.querySelector("h2, h1");
      if (title) {
        title.textContent = "Game Over";
      }
      const para = startPanel.querySelector("p");
      if (para) {
        para.textContent = `Du hast ${Math.floor(
          score
        )} Punkte erreicht. Versuch's gleich nochmal!`;
      }
      if (startButton) {
        startButton.textContent = "Nochmal spielen";
      }
    }
  }

  // =====================================================================
  // Animations-Loop
  // =====================================================================

  function startMainLoop() {
    if (loopStarted) return;
    loopStarted = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    const delta = (now - lastTime) / 1000; // Sekunden
    lastTime = now;

    if (running) {
      elapsedTime += delta;
      score += delta * 60; // Punkte / Sekunde
      updateObstacles(delta);
      updateHud();
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }

    requestAnimationFrame(loop);
  }

  // =====================================================================
  // UI / Input
  // =====================================================================

  function initUI() {
    // Startbutton
    if (startButton) {
      startButton.addEventListener("click", function () {
        startGame();
      });
    }

    // Charakter-Buttons
    characterButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const idx = parseInt(btn.dataset.character || "0", 10) || 0;
        setActiveCharacter(idx);
      });
    });

    // Keyboard
    window.addEventListener("keydown", function (e) {
      if (!running) return;

      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        movePlayerLeft();
      } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        movePlayerRight();
      }
    });

    // Start: aktiven Button erkennen
    const activeBtn = document.querySelector("[data-character].active");
    if (activeBtn) {
      const idx = parseInt(activeBtn.dataset.character || "3", 10) || 3;
      currentCharacterIndex = idx;
    }
    setActiveCharacter(currentCharacterIndex);
  }

  // =====================================================================
  // Start, sobald DOM & Scripts geladen sind
  // =====================================================================

  window.addEventListener("load", init);
})();
