// main.js - Bürogummi Run 3D
// Three.js endless runner, stabil und defensiv programmiert

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Basis-Setup
  // ---------------------------------------------------------------------------

  var scene, camera, renderer;
  var playerGroup;
  var floorSegments = [];
  var obstacles = [];

  var laneXPositions = [-4, 0, 4];
  var currentLane = 1;
  var targetLane = 1;

  var obstacleSpawnStartZ = -60;
  var obstacleSpacing = 18;
  var lastSpawnZ = obstacleSpawnStartZ;

  var speed = 18;
  var maxSpeed = 60;
  var isGameOver = false;
  var score = 0;

  var clock = new THREE.Clock();

  var tmpPlayerBox = new THREE.Box3();
  var tmpObstacleBox = new THREE.Box3();

  var scoreDisplay = document.getElementById('score');
  var gameOverOverlay = document.getElementById('overlay');
  var startScreen = document.getElementById('start-screen');
  var startButton = document.getElementById('start-button');
  var restartButton = document.getElementById('restart');
  var finalScoreDisplay = document.getElementById('final-score');
  var finalTimeDisplay = document.getElementById('final-time');

  var gameStarted = false;
  var gameStartTime = 0;

  function updateScoreUI() {
    if (scoreDisplay) {
      scoreDisplay.textContent = 'Score: ' + score;
    }
  }

  function updateTimeUI() {
    var timeSpan = document.getElementById('time');
    if (timeSpan && gameStarted) {
      var elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
      timeSpan.textContent = 'Zeit: ' + elapsed + 's';
      if (isGameOver && finalTimeDisplay) {
        finalTimeDisplay.textContent = 'Zeit: ' + elapsed + 's';
      }
    }
  }

  function setGameOverUI(show) {
    if (gameOverOverlay) {
      gameOverOverlay.classList.toggle('hidden', !show);
      if (show && finalScoreDisplay) {
        finalScoreDisplay.textContent = 'Score: ' + score;
      }
    }
  }

  function showStartScreen(show) {
    if (startScreen) {
      startScreen.classList.toggle('hidden', !show);
    }
  }

  // ---------------------------------------------------------------------------
  // Charaktere
  // ---------------------------------------------------------------------------

  var characters = [
    { id: 'leni',   bodyColor: 0xf97316, accentColor: 0xfacc15 },
    { id: 'nico',   bodyColor: 0x3b82f6, accentColor: 0x0ea5e9 },
    { id: 'sam',    bodyColor: 0x22c55e, accentColor: 0x15803d },
    { id: 'keller', bodyColor: 0x6366f1, accentColor: 0x38bdf8 }
  ];

  function pickRandomCharacter() {
    var index = Math.floor(Math.random() * characters.length);
    return characters[index];
  }

  function buildPlayer(character) {
    var group = new THREE.Group();

    var bodyMat = new THREE.MeshStandardMaterial({ color: character.bodyColor });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xfacc9d });
    var accentMat = new THREE.MeshStandardMaterial({ color: character.accentColor });

    // Körper
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.7), bodyMat);
    body.position.y = 1.4;
    group.add(body);

    // Kopf
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.7), skinMat);
    head.position.y = 2.4;
    group.add(head);

    // Füsse
    var footGeo = new THREE.BoxGeometry(0.4, 0.3, 0.7);
    var shoeMat = new THREE.MeshStandardMaterial({ color: 0x111827 });

    var footL = new THREE.Mesh(footGeo, shoeMat);
    footL.position.set(-0.25, 0.2, 0);
    group.add(footL);

    var footR = new THREE.Mesh(footGeo, shoeMat);
    footR.position.set(0.25, 0.2, 0);
    group.add(footR);

    // Charakter-spezifische Akzente
    if (character.id === 'leni') {
      // Mappe unter dem Arm
      var folder = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.15, 0.08),
        accentMat
      );
      folder.position.set(0.05, 1.35, 0.55);
      group.add(folder);
    } else if (character.id === 'nico') {
      // farbiger Rand am Outfit
      var trim = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 1.6, 0.95),
        accentMat
      );
      trim.position.y = 1.3;
      group.add(trim);

      // Laptop vor dem Körper
      var laptop = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.2, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9 })
      );
      laptop.position.set(0, 1.25, 0.55);
      group.add(laptop);
    } else if (character.id === 'sam') {
      // Zwei Streifen auf dem Outfit (ohne clone(), wegen Safari-Bug)
      var stripeGeo = new THREE.BoxGeometry(1, 0.08, 0.95);

      var stripe1 = new THREE.Mesh(stripeGeo, accentMat);
      stripe1.position.y = 1.55;
      group.add(stripe1);

      var stripe2 = new THREE.Mesh(stripeGeo, accentMat);
      stripe2.position.y = 1.1;
      group.add(stripe2);

      // Schlüsselbund
      var keys = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.25, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xb0b5c2 })
      );
      keys.position.set(-0.65, 1.1, 0.3);
      group.add(keys);
    } else if (character.id === 'keller') {
      // Hemdkragen
      var collar = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.12, 0.95),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      collar.position.y = 2.0;
      group.add(collar);

      // Krawatte
      var tie = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.6, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x0f172a })
      );
      tie.position.set(0, 1.65, 0.55);
      group.add(tie);

      // Ordner in der Hand
      var folder2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.55, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x93c5fd })
      );
      folder2.position.set(0.68, 1.3, 0.2);
      group.add(folder2);
    }

    // Leichte Vorbeugung, damit es dynamischer aussieht
    group.rotation.x = -0.1;

    return group;
  }

  // ---------------------------------------------------------------------------
  // Hindernisse
  // ---------------------------------------------------------------------------

  var obstacleTypes = [
    { key: 'paper',   color: 0xe2e8f0, size: [1.5, 0.5, 1.2] },
    { key: 'box',     color: 0xa16207, size: [1.2, 2.1, 1.2] },
    { key: 'drawer',  color: 0x475569, size: [1.4, 1.2, 1.1] },
    { key: 'printer', color: 0xcbd5e1, size: [1.6, 1.3, 1.2] },
    { key: 'cup',     color: 0xf59e0b, size: [0.7, 0.9, 0.7] },
    { key: 'plant',   color: 0x10b981, size: [1.0, 1.3, 1.0] },
    { key: 'eraser',  color: 0xef4444, size: [1.2, 0.6, 0.9] }
  ];

  function createObstacleMesh(typeKey) {
    var cfg = null;
    for (var i = 0; i < obstacleTypes.length; i++) {
      if (obstacleTypes[i].key === typeKey) {
        cfg = obstacleTypes[i];
        break;
      }
    }
    if (!cfg) {
      cfg = obstacleTypes[0];
    }

    var size = cfg.size || [1, 1, 1];
    var w = size[0];
    var h = size[1];
    var d = size[2];

    var base = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: cfg.color })
    );

    // userData defensiv initialisieren (Safari)
    if (!base.userData) {
      base.userData = {};
    }
    base.userData.size = { x: w, y: h, z: d };
    base.userData.type = cfg.key;

    // Zusätzliche Formen für Wiedererkennung
    if (cfg.key === 'printer') {
      var top = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.9, h * 0.35, d * 0.9),
        new THREE.MeshStandardMaterial({ color: 0xe5e7eb })
      );
      top.position.y = h * 0.35;
      base.add(top);
    } else if (cfg.key === 'box') {
      var tape = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.02, 0.05, d * 0.25),
        new THREE.MeshStandardMaterial({ color: 0xfacc15 })
      );
      tape.position.y = h * 0.02;
      base.add(tape);
    } else if (cfg.key === 'drawer') {
      var handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.06, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      handle.position.set(0, 0.15, d * 0.52);
      base.add(handle);
    } else if (cfg.key === 'cup') {
      var rim = new THREE.Mesh(
        new THREE.CylinderGeometry((w * 0.5) * 0.95, (w * 0.5) * 0.95, 0.05, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      rim.position.y = h * 0.5;
      base.add(rim);
    } else if (cfg.key === 'plant') {
      var pot = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.3, w * 0.5, h * 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x92400e })
      );
      pot.position.y = h * 0.2;
      base.add(pot);
    }

    return base;
  }

  function spawnObstacle(zPos) {
    var index = Math.floor(Math.random() * obstacleTypes.length);
    var typeKey = obstacleTypes[index].key;

    var mesh = createObstacleMesh(typeKey);

    var laneIndex = Math.floor(Math.random() * laneXPositions.length);
    var laneX = laneXPositions[laneIndex];

    var size = (mesh.userData && mesh.userData.size) ?
      mesh.userData.size :
      { x: 1, y: 1, z: 1 };

    mesh.position.set(laneX, size.y / 2, zPos);
    scene.add(mesh);
    obstacles.push(mesh);
  }

  // ---------------------------------------------------------------------------
  // Game-Setup
  // ---------------------------------------------------------------------------

  function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);

    var aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 200);
    camera.position.set(0, 7, 16);
    camera.lookAt(0, 2, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Wenn es ein explizites Container-Element gibt, dort anhängen, sonst body
    var container = document.getElementById('gameRoot') || document.body;
    container.appendChild(renderer.domElement);

    // Licht
    var ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    var dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(10, 20, 10);
    scene.add(dir);

    // Boden-Segmente (scrollend)
    var floorGeo = new THREE.PlaneGeometry(20, 40);
    var floorMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb });

    for (var i = 0; i < 3; i++) {
      var floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.z = -i * 40;
      scene.add(floor);
      floorSegments.push(floor);
    }

    // Lane-Markierungen (nur optisch)
    var laneMat = new THREE.LineBasicMaterial({ color: 0x94a3b8 });
    for (var li = 0; li < laneXPositions.length; li++) {
      var points = [];
      points.push(new THREE.Vector3(laneXPositions[li], 0.01, 20));
      points.push(new THREE.Vector3(laneXPositions[li], 0.01, -120));
      var laneGeo = new THREE.BufferGeometry().setFromPoints(points);
      var line = new THREE.Line(laneGeo, laneMat);
      scene.add(line);
    }

    // Spieler
    var chosen = pickRandomCharacter();
    playerGroup = buildPlayer(chosen);
    playerGroup.position.set(laneXPositions[currentLane], 0, 4);
    scene.add(playerGroup);

    // Erste Hindernisse
    obstacles.length = 0;
    lastSpawnZ = obstacleSpawnStartZ;
    for (var j = 0; j < 8; j++) {
      spawnObstacle(lastSpawnZ);
      lastSpawnZ -= obstacleSpacing;
    }

    updateScoreUI();
    setGameOverUI(false);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
  }

  function resetGame() {
    // Hindernisse entfernen
    for (var i = 0; i < obstacles.length; i++) {
      scene.remove(obstacles[i]);
    }
    obstacles.length = 0;

    // Spieler zurücksetzen
    currentLane = 1;
    targetLane = 1;
    if (playerGroup) {
      playerGroup.position.set(laneXPositions[currentLane], 0, 4);
      playerGroup.rotation.z = 0;
    }

    // Boden neu ausrichten
    for (var f = 0; f < floorSegments.length; f++) {
      floorSegments[f].position.z = -f * 40;
    }

    // Parameter
    speed = 18;
    score = 0;
    isGameOver = false;
    updateScoreUI();
    setGameOverUI(false);

    lastSpawnZ = obstacleSpawnStartZ;
    for (var j = 0; j < 8; j++) {
      spawnObstacle(lastSpawnZ);
      lastSpawnZ -= obstacleSpacing;
    }

    clock.getDelta(); // Clock "leeren"
  }

  // ---------------------------------------------------------------------------
  // Game-Loop
  // ---------------------------------------------------------------------------

  function update(delta) {
    var moveZ = speed * delta;

    // Boden weiterschieben (Endless-Effekt)
    for (var i = 0; i < floorSegments.length; i++) {
      var floor = floorSegments[i];
      floor.position.z += moveZ;
      if (floor.position.z > 40) {
        floor.position.z -= 40 * floorSegments.length;
      }
    }

    // Hindernisse bewegen
    for (var o = obstacles.length - 1; o >= 0; o--) {
      var obs = obstacles[o];
      obs.position.z += moveZ;

      if (obs.position.z > 25) {
        // Hinter dem Spieler -> entfernen, Score erhöhen, neues SPAWNEN
        scene.remove(obs);
        obstacles.splice(o, 1);

        score += 10;
        if (speed < maxSpeed) {
          speed += 0.4;
        }
        updateScoreUI();

        lastSpawnZ -= obstacleSpacing;
        spawnObstacle(lastSpawnZ);
      }
    }

    // Lane-Wechsel smooth animieren
    var targetX = laneXPositions[targetLane];
    var diffX = targetX - playerGroup.position.x;
    var maxStep = delta * 10;
    if (Math.abs(diffX) > 0.001) {
      var step = Math.sign(diffX) * Math.min(Math.abs(diffX), maxStep);
      playerGroup.position.x += step;
    }

    // Leichte Neigung
    playerGroup.rotation.z = -diffX * 0.12;

    // Kollisionen prüfen
    tmpPlayerBox.setFromObject(playerGroup);
    for (var k = 0; k < obstacles.length; k++) {
      tmpObstacleBox.setFromObject(obstacles[k]);
      if (tmpPlayerBox.intersectsBox(tmpObstacleBox)) {
        isGameOver = true;
        setGameOverUI(true);
        break;
      }
    }
  }

  function animate() {
    requestAnimationFrame(animate);

    var delta = clock.getDelta();
    if (gameStarted && !isGameOver) {
      update(delta);
      updateTimeUI();
    }

    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function onWindowResize() {
    if (!camera || !renderer) return;
    var aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onKeyDown(e) {
    var code = e.code;

    if (code === 'ArrowLeft' || code === 'KeyA') {
      if (targetLane > 0) {
        targetLane -= 1;
      }
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      if (targetLane < laneXPositions.length - 1) {
        targetLane += 1;
      }
    } else if (code === 'KeyR') {
      if (isGameOver) {
        resetGame();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Event Listeners
  // ---------------------------------------------------------------------------

  function startGame() {
    gameStarted = true;
    gameStartTime = Date.now();
    showStartScreen(false);
    setGameOverUI(false);
  }

  if (startButton) {
    startButton.addEventListener('click', startGame);
  }

  if (restartButton) {
    restartButton.addEventListener('click', function () {
      resetGame();
      startGame();
    });
  }

  // Character selection (changes appearance for next game)
  var characterButtons = document.querySelectorAll('.character-select button');
  for (var cb = 0; cb < characterButtons.length; cb++) {
    characterButtons[cb].addEventListener('click', function (e) {
      // Remove active class from all buttons
      for (var i = 0; i < characterButtons.length; i++) {
        characterButtons[i].classList.remove('active');
      }
      // Add active class to clicked button
      e.target.classList.add('active');
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  initScene();
  showStartScreen(true);
  setGameOverUI(false);
  animate();

})();
