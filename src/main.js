import { createRenderer } from "./render.js";
import { createGame } from "./game.js";
import { bindInput } from "./input.js";
import { createStrategyBot, DELAY_STEP_MS } from "./bot.js";
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
const btnBot = document.getElementById("btn-bot");
const btnBotSlower = document.getElementById("btn-bot-slower");
const btnBotFaster = document.getElementById("btn-bot-faster");
const btnOverRestart = document.getElementById("btn-over-restart");
const btnOverBoard = document.getElementById("btn-over-board");

const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const recordScoreEl = document.getElementById("record-score");
const recordTimeEl = document.getElementById("record-time");
const recordDateEl = document.getElementById("record-date");
const botSpeedEl = document.getElementById("bot-speed");

const renderer = createRenderer(boardEl, overlayEl);
let gameOverOverlayDismissed = false;

const renderGameView = () => {
  renderer.render(game.state);
  if (game.state.isGameOver && gameOverOverlayDismissed) {
    renderer.showGameOver(false);
  }
};

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
game.setScoreListener((score) => {
  scoreEl.textContent = score;
});

const updateBotUi = ({ running, delayMs, minDelayMs, maxDelayMs }) => {
  if (!btnBot) return;
  btnBot.textContent = running ? "停止托管" : "托管";
  btnBot.classList.toggle("active", running);
  if (botSpeedEl) {
    botSpeedEl.textContent = `${delayMs}ms`;
  }
  if (btnBotFaster) {
    btnBotFaster.disabled = delayMs <= minDelayMs;
  }
  if (btnBotSlower) {
    btnBotSlower.disabled = delayMs >= maxDelayMs;
  }
};

const bot = createStrategyBot({
  getState: () => game.getBotState(),
  requestMove: (dir) => game.handleMove(dir),
  onChange: updateBotUi,
  delayMs: 180,
});

const stopBot = () => {
  bot.stop();
};

const handlePlayerMove = (dir) => {
  stopBot();
  game.handleMove(dir);
};

const handleUndo = () => {
  stopBot();
  gameOverOverlayDismissed = false;
  game.undo();
};

const refreshContinue = () => {
  const current = loadCurrentGame();
  btnContinue.disabled = current === null;
};

const showEntry = () => {
  stopBot();
  gameOverOverlayDismissed = false;
  entryEl.classList.remove("hidden");
  gameEl.classList.add("hidden");
  renderer.showGameOver(false);
  refreshContinue();
};

const showGame = () => {
  entryEl.classList.add("hidden");
  gameEl.classList.remove("hidden");
  renderer.measure();
  renderGameView();
};

const bestRecord = loadBestRecord() || { score: 0, durationMs: 0, timestamp: 0 };
updateBestScore(bestRecord);
game.setBestRecord(bestRecord);

refreshContinue();

btnStart.addEventListener("click", () => {
  stopBot();
  gameOverOverlayDismissed = false;
  clearCurrentGame();
  game.startNew();
  showGame();
});

btnContinue.addEventListener("click", () => {
  stopBot();
  gameOverOverlayDismissed = false;
  const current = loadCurrentGame();
  if (!current) return;
  game.continueFrom(current);
  showGame();
});

btnUndo.addEventListener("click", handleUndo);
btnRestart.addEventListener("click", () => {
  stopBot();
  gameOverOverlayDismissed = false;
  game.restart();
});
btnBack.addEventListener("click", () => {
  showEntry();
});
if (btnBot) {
  btnBot.addEventListener("click", () => {
    if (game.state.isGameOver) return;
    bot.toggle();
  });
}
if (btnBotSlower) {
  btnBotSlower.addEventListener("click", () => {
    bot.adjustDelay(DELAY_STEP_MS);
  });
}
if (btnBotFaster) {
  btnBotFaster.addEventListener("click", () => {
    bot.adjustDelay(-DELAY_STEP_MS);
  });
}
btnOverRestart.addEventListener("click", () => {
  stopBot();
  gameOverOverlayDismissed = false;
  game.restart();
});
btnOverBoard.addEventListener("click", () => {
  gameOverOverlayDismissed = true;
  renderer.showGameOver(false);
});

bindInput(boardEl, {
  onMove: handlePlayerMove,
  onUndo: handleUndo,
});

window.addEventListener("resize", () => {
  renderer.measure();
  renderGameView();
});

updateBotUi({
  running: false,
  delayMs: bot.getDelay(),
  ...bot.getDelayConfig(),
});
