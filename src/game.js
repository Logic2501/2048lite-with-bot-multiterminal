import {
  createEmptyState,
  addRandomTile,
  moveTiles,
  canMove,
  snapshotState,
  restoreSnapshot,
  restoreFromSave,
} from "./board.js";
import { runAnimation, cancelAnimation } from "./animation.js";
import { updateElapsed, resetTimer, restoreTimer } from "./timer.js";
import { saveCurrentGame, clearCurrentGame } from "./storage.js";

const ANIM_MS = 120;

export function createGame(renderer, onBestUpdate) {
  const state = createEmptyState();
  let bestRecord = null;
  let scoreListener = null;

  const updateBest = () => {
    if (!bestRecord) {
      bestRecord = { score: 0, durationMs: 0, timestamp: 0 };
    }
    if (state.score > bestRecord.score) {
      bestRecord = {
        score: state.score,
        durationMs: state.elapsedMs,
        timestamp: Date.now(),
      };
      if (onBestUpdate) onBestUpdate(bestRecord);
    }
  };

  const notifyScore = () => {
    if (scoreListener) scoreListener(state.score);
  };

  const renderAll = () => {
    renderer.render(state);
  };

  const pruneMergedOut = () => {
    const toRemove = [];
    state.tiles.forEach((tile) => {
      if (tile.isMergedOut) toRemove.push(tile.id);
    });
    toRemove.forEach((id) => state.tiles.delete(id));
  };

  const clearTransientState = () => {
    state.tiles.forEach((tile) => {
      tile.isNew = false;
      tile.mergedFrom = null;
    });
  };

  const initBoard = () => {
    state.boardCells.fill(null);
    state.tiles.clear();
    state.nextTileId = 1;
    state.score = 0;
    state.isGameOver = false;
    state.undoStack = [];
    resetTimer(state);
    addRandomTile(state);
    addRandomTile(state);
    state.tiles.forEach((tile) => {
      tile.isNew = false;
    });
    renderer.clearTransient();
    renderAll();
    notifyScore();
    saveCurrentGame(state);
  };

  const startNew = () => {
    cancelAnimation(state);
    initBoard();
  };

  const continueFrom = (saved) => {
    cancelAnimation(state);
    restoreFromSave(state, saved);
    pruneMergedOut();
    restoreTimer(state, state.elapsedMs);
    renderer.clearTransient();
    renderAll();
    notifyScore();
  };

  const handleMove = (dir) => {
    if (state.isAnimating || state.isGameOver) return;
    const snapshot = snapshotState(state);
    const result = moveTiles(state, dir);
    if (!result.moved) {
      restoreSnapshot(state, snapshot);
      return;
    }
    state.undoStack = [snapshot];
    updateElapsed(state);
    addRandomTile(state);
    state.isGameOver = !canMove(state);
    updateBest();
    saveCurrentGame(state);
    renderAll();
    notifyScore();
    runAnimation(state, ANIM_MS, () => {
      pruneMergedOut();
      clearTransientState();
      renderer.clearTransient();
      renderer.render(state);
      if (state.isGameOver) clearCurrentGame();
    });
  };

  const undo = () => {
    if (state.isAnimating) return;
    const snapshot = state.undoStack.pop();
    if (!snapshot) return;
    restoreSnapshot(state, snapshot);
    pruneMergedOut();
    restoreTimer(state, state.elapsedMs);
    saveCurrentGame(state);
    renderer.clearTransient();
    renderAll();
    notifyScore();
  };

  const restart = () => {
    startNew();
  };

  const clearSave = () => {
    clearCurrentGame();
  };

  const getBotState = () => ({
    size: state.size,
    cells: state.boardCells.map((id) => {
      if (id === null) return 0;
      const tile = state.tiles.get(id);
      return tile ? tile.value : 0;
    }),
    score: state.score,
    isAnimating: state.isAnimating,
    isGameOver: state.isGameOver,
  });

  return {
    state,
    startNew,
    continueFrom,
    handleMove,
    undo,
    restart,
    setBestRecord(record) {
      bestRecord = record;
    },
    getBestRecord() {
      return bestRecord;
    },
    setScoreListener(listener) {
      scoreListener = listener;
      notifyScore();
    },
    getBotState,
    clearSave,
  };
}
