import { createRenderer } from "./render.js";
import { createGame } from "./game.js";
import { bindInput } from "./input.js";
import { createUiShell } from "./ui-shell.js";
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
const ui = createUiShell({
  entryEl,
  gameEl,
  renderer,
  btnContinue,
  bestScoreEl,
  recordScoreEl,
  recordTimeEl,
  recordDateEl,
  loadCurrentGame,
  saveBestRecord,
  formatDuration,
});

const game = createGame(renderer, ui.updateBestScore);

const bestRecord = loadBestRecord() || { score: 0, durationMs: 0, timestamp: 0 };
ui.updateBestScore(bestRecord);
game.setBestRecord(bestRecord);

ui.refreshContinue();

btnStart.addEventListener("click", () => {
  clearCurrentGame();
  game.startNew();
  ui.showGame(game.state);
});

btnContinue.addEventListener("click", () => {
  const current = loadCurrentGame();
  if (!current) return;
  game.continueFrom(current);
  ui.showGame(game.state);
});

btnUndo.addEventListener("click", () => game.undo());
btnRestart.addEventListener("click", () => game.restart());
btnBack.addEventListener("click", () => {
  ui.showEntry();
});
btnOverRestart.addEventListener("click", () => game.restart());
btnOverEntry.addEventListener("click", () => ui.showEntry());

bindInput(boardEl, {
  onMove: (dir) => game.handleMove(dir),
  onUndo: () => game.undo(),
});

window.addEventListener("resize", () => {
  renderer.measure();
  renderer.render(game.state);
});
