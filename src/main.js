import { createRenderer } from "./render.js";
import { createGame } from "./game.js";
import { bindInput } from "./input.js";
import {
  loadBestRecord,
  loadCurrentGame,
  saveBestRecord,
  clearCurrentGame,
} from "./storage.js";
import { formatDuration } from "./timer.js";

const entryEl = document.getElementById("entry");
const gameEl = document.getElementById("game");
const boardEl = document.getElementById("board");
const overlayEl = document.getElementById("game-over");

const btnStart = document.getElementById("btn-start");
const btnContinue = document.getElementById("btn-continue");
const btnUndo = document.getElementById("btn-undo");
const btnRestart = document.getElementById("btn-restart");
const btnBack = document.getElementById("btn-back");
const btnOverRestart = document.getElementById("btn-over-restart");
const btnOverEntry = document.getElementById("btn-over-entry");

const bestScoreEl = document.getElementById("best-score");
const recordScoreEl = document.getElementById("record-score");
const recordTimeEl = document.getElementById("record-time");
const recordDateEl = document.getElementById("record-date");

const renderer = createRenderer(boardEl, overlayEl);

const updateEntryRecord = (record) => {
  if (!record || record.score === 0) {
    recordScoreEl.textContent = "--";
    recordTimeEl.textContent = "--";
    recordDateEl.textContent = "--";
    return;
  }
  recordScoreEl.textContent = record.score;
  recordTimeEl.textContent = formatDuration(record.durationMs);
  recordDateEl.textContent = new Date(record.timestamp).toLocaleString();
};

const updateBestScore = (record) => {
  bestScoreEl.textContent = record ? record.score : 0;
  updateEntryRecord(record);
  if (record) saveBestRecord(record);
};

const game = createGame(renderer, updateBestScore);

const refreshContinue = () => {
  const current = loadCurrentGame();
  btnContinue.disabled = current === null;
};

const showEntry = () => {
  entryEl.classList.remove("hidden");
  gameEl.classList.add("hidden");
  renderer.showGameOver(false);
  refreshContinue();
};

const showGame = () => {
  entryEl.classList.add("hidden");
  gameEl.classList.remove("hidden");
  renderer.measure();
  renderer.render(game.state);
};

const bestRecord = loadBestRecord() || { score: 0, durationMs: 0, timestamp: 0 };
updateBestScore(bestRecord);
game.setBestRecord(bestRecord);

refreshContinue();

btnStart.addEventListener("click", () => {
  clearCurrentGame();
  game.startNew();
  showGame();
});

btnContinue.addEventListener("click", () => {
  const current = loadCurrentGame();
  if (!current) return;
  game.continueFrom(current);
  showGame();
});

btnUndo.addEventListener("click", () => game.undo());
btnRestart.addEventListener("click", () => game.restart());
btnBack.addEventListener("click", () => {
  showEntry();
});
btnOverRestart.addEventListener("click", () => game.restart());
btnOverEntry.addEventListener("click", () => showEntry());

bindInput(boardEl, {
  onMove: (dir) => game.handleMove(dir),
  onUndo: () => game.undo(),
});

window.addEventListener("resize", () => {
  renderer.measure();
  renderer.render(game.state);
});
