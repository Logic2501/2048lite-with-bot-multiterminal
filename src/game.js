import {
  createEmptyState,
  addRandomTile,
  moveTiles,
  canMove,
  snapshotState,
  restoreSnapshot,
  restoreFromSave,
  clearTileTransientState,
} from "./board.js";
import { runAnimation, cancelAnimation } from "./animation.js";
import { updateElapsed, resetTimer, restoreTimer } from "./timer.js";
import { saveCurrentGame, clearCurrentGame } from "./storage.js";

const ANIM_MS = 120;

export function createGame(renderer, onBestUpdate) {
  const state = createEmptyState();
  let bestRecord = null;

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

  const renderAll = () => {
    renderer.render(state);
  };

  const pruneMergedOut = () => {
    const toRemove = [];
    state.tiles.forEach((tile) => {
      if (tile.isRemoved()) toRemove.push(tile.id);
    });
    toRemove.forEach((id) => state.tiles.delete(id));
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
      tile.clearTransient();
    });
    renderer.clearTransient();
    renderAll();
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
    runAnimation(state, ANIM_MS, () => {
      pruneMergedOut();
      clearTileTransientState(state);
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
  };

  const restart = () => {
    startNew();
  };

  const clearSave = () => {
    clearCurrentGame();
  };

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
    clearSave,
  };
}
