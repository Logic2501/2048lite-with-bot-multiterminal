import { createRenderer } from "./render.js";
import { createGame } from "./game.js";
import { bindInput } from "./input.js";
import { createStrategyBot, DELAY_STEP_MS } from "./bot.js";
import { createExpertRecorder } from "./recorder.js";
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
const actionsEl = document.querySelector(".actions");

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

const game = createGame(renderer, updateBestScore);

const recorderControls = document.createElement("div");
recorderControls.className = "bot-controls";

const btnRecord = document.createElement("button");
btnRecord.type = "button";
btnRecord.className = "btn ghost";
btnRecord.textContent = "开始录制";
btnRecord.setAttribute("aria-label", "开始或停止录制专家操作");

const recordStatusEl = document.createElement("span");
recordStatusEl.className = "bot-speed";
recordStatusEl.textContent = "未录制";

recorderControls.append(btnRecord, recordStatusEl);
if (actionsEl) actionsEl.append(recorderControls);

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

function updateBestScore(record) {
  bestScoreEl.textContent = record ? record.score : 0;
  updateEntryRecord(record);
  if (record) saveBestRecord(record);
}

game.setScoreListener((score) => {
  scoreEl.textContent = score;
});

const syncBotButtons = ({ recording, delayMs, minDelayMs, maxDelayMs }) => {
  if (btnBot) btnBot.disabled = recording;
  if (btnBotFaster) btnBotFaster.disabled = recording || delayMs <= minDelayMs;
  if (btnBotSlower) btnBotSlower.disabled = recording || delayMs >= maxDelayMs;
};

let recorderUiState = {
  recording: false,
  steps: 0,
};

const updateRecorderUi = ({ recording, steps }) => {
  recorderUiState = { recording, steps };
  btnRecord.textContent = recording ? "停止录制" : "开始录制";
  btnRecord.classList.toggle("active", recording);
  recordStatusEl.textContent = recording ? `${steps}步` : "未录制";
  syncBotButtons({
    recording,
    delayMs: bot.getDelay(),
    ...bot.getDelayConfig(),
  });
};

const updateBotUi = ({ running, delayMs, minDelayMs, maxDelayMs }) => {
  if (!btnBot) return;
  btnBot.textContent = running ? "停止托管" : "托管";
  btnBot.classList.toggle("active", running);
  if (botSpeedEl) {
    botSpeedEl.textContent = `${delayMs}ms`;
  }
  syncBotButtons({
    recording: recorderUiState.recording,
    delayMs,
    minDelayMs,
    maxDelayMs,
  });
};

const bot = createStrategyBot({
  getState: () => game.getBotState(),
  requestMove: (dir) => game.handleMove(dir),
  onChange: updateBotUi,
  delayMs: 180,
});

const recorder = createExpertRecorder({
  getState: () => game.getRecordState(),
  onChange: updateRecorderUi,
});

const stopBot = () => {
  bot.stop();
};

const stopRecorder = (reason) => {
  recorder.stop(reason);
};

const recordMove = (dir, actor = "human") => {
  const before = game.getRecordState();
  const applied = game.handleMove(dir);
  const after = game.getRecordState();
  if (recorder.isRecording()) {
    recorder.recordStep({
      type: "move",
      action: dir,
      actor,
      before,
      after,
      applied,
    });
  }
  if (applied && after.isGameOver && recorder.isRecording()) {
    stopRecorder("game_over");
  }
};

const handlePlayerMove = (dir) => {
  stopBot();
  recordMove(dir, "human");
};

const handleUndo = () => {
  stopBot();
  gameOverOverlayDismissed = false;
  const before = game.getRecordState();
  const applied = game.undo();
  const after = game.getRecordState();
  if (recorder.isRecording()) {
    recorder.recordStep({
      type: "undo",
      action: "undo",
      actor: "human",
      before,
      after,
      applied,
    });
  }
};

const toggleRecorder = () => {
  if (!gameEl || gameEl.classList.contains("hidden")) return;
  if (recorder.isRecording()) {
    stopRecorder("manual");
    return;
  }
  stopBot();
  recorder.start();
};

const refreshContinue = () => {
  const current = loadCurrentGame();
  btnContinue.disabled = current === null;
};

const showEntry = () => {
  stopBot();
  stopRecorder("leave_game");
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
  stopRecorder("start_new");
  gameOverOverlayDismissed = false;
  clearCurrentGame();
  game.startNew();
  showGame();
});

btnContinue.addEventListener("click", () => {
  stopBot();
  stopRecorder("continue");
  gameOverOverlayDismissed = false;
  const current = loadCurrentGame();
  if (!current) return;
  game.continueFrom(current);
  showGame();
});

btnUndo.addEventListener("click", handleUndo);
btnRestart.addEventListener("click", () => {
  stopBot();
  stopRecorder("restart");
  gameOverOverlayDismissed = false;
  game.restart();
});
btnBack.addEventListener("click", () => {
  showEntry();
});
if (btnBot) {
  btnBot.addEventListener("click", () => {
    if (game.state.isGameOver || recorder.isRecording()) return;
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
  stopRecorder("restart");
  gameOverOverlayDismissed = false;
  game.restart();
});
btnOverBoard.addEventListener("click", () => {
  gameOverOverlayDismissed = true;
  renderer.showGameOver(false);
});
btnRecord.addEventListener("click", toggleRecorder);

bindInput(boardEl, {
  onMove: handlePlayerMove,
  onUndo: handleUndo,
  onToggleRecord: toggleRecorder,
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
updateRecorderUi({
  recording: recorder.isRecording(),
  steps: recorder.getActiveSession() ? recorder.getActiveSession().steps.length : 0,
});
