// main.js – 2D-Bürogummi-Runner mit Büro-Hintergrund & Büro-Obstacles

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const timeEl = document.getElementById("time");
  const startScreen = document.getElementById("start-screen");
  const gameOverScreen = document.getElementById("gameover-screen");
  const startBtn = document.getElementById("start-button");
  const restartBtn = document.getElementById("restart-button");
  const finalScoreEl = document.getElementById("final-score");
  const charButtons = document.querySelectorAll(".character-select button");

  if (!canvas || !ctx) {
    console.error("Canvas nicht gefunden – prüfe index.html");
    return;
  }

  const width = canvas.width;
  const height = canvas.height;

  // ---- Lanes ----------------------------------------------------
  const laneCount = 3;
  const lanePositions = [width * 0.25, width * 0.5, width * 0.75];
  const laneWidth = width * 0.24;

  // ---- Charaktere ----------------------------------------------
  const CHARACTERS = [
    { name: "Leni", bodyColor: "#7cf5ff", accentColor: "#ffffff" },
    { name: "Nico", bodyColor: "#57ffb3", accentColor: "#021018" },
    { name: "Sam", bodyColor: "#ffdd73", accentColor: "#3b2b00" },
    { name: "Keller", bodyColor: "#ff7cc3", accentColor: "#2b0016" },
  ];
  let currentCharacterIndex = 0;

  // ---- Büro-Hindernisse ----------------------------------------
  const OBSTACLE_TYPES = [
    {
      key: "monitor",
      width: 70,
      height: 50,
      color: "#1c2440",
      detail: "#c8e0ff",
    },
    {
      key: "chair",
      width: 60,
      height: 70,
      color: "#222b46",
      detail: "#4b5b9a",
    },
    {
      key: "files",
      width: 65,
      height: 55,
      color: "#2b324d",
      detail: "#9ad0ff",
    },
    {
      key: "coffee",
      width: 45,
      height: 50,
      color: "#f5f5f5",
      detail: "#c07b3f",
    },
  ];

  // ---- Game State ----------------------------------------------
  let laneIndex = 1; // 0 = links, 1 = mitte, 2 = rechts
  const obstacles = [];
  let running = false;
  let lastTime = 0;
  let obstacleTimer = 0;
  let obstacleInterval = 1.0; // Sekunden
  let speed = 260; // px / s
  let score = 0;
  let lives = 3;
  let elapsedTime = 0;
  let invulTime = 0;

  function updateHUD() {
    scoreEl.textContent = `Score: ${Math.floor(score)}`;
    livesEl.textContent = `Leben: ${lives}`;
    timeEl.textContent = `Zeit: ${Math.floor(elapsedTime)}s`;
  }

  function resetGameState() {
    laneIndex = 1;
    obstacles.length = 0;
    running = true;
    lastTime = 0;
    obstacleTimer = 0;
    obstacleInterval = 1.0;
    speed = 260;
    score = 0;
    lives = 3;
    elapsedTime = 0;
    invulTime
