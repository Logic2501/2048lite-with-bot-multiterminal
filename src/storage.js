const KEY_BEST = "2048_best_record";
const KEY_GAME = "2048_current_game";

export function loadBestRecord() {
  const raw = localStorage.getItem(KEY_BEST);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveBestRecord(record) {
  if (record === null || record === undefined) return;
  localStorage.setItem(KEY_BEST, JSON.stringify(record));
}

export function clearCurrentGame() {
  localStorage.removeItem(KEY_GAME);
}

export function loadCurrentGame() {
  const raw = localStorage.getItem(KEY_GAME);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCurrentGame(state) {
  if (state === null || state === undefined) return;
  const payload = {
    size: state.size,
    score: state.score,
    elapsedMs: state.elapsedMs,
    startTime: state.startTime,
    nextTileId: state.nextTileId,
    boardCells: state.boardCells,
    tiles: Array.from(state.tiles.values()).map((tile) => ({
      id: tile.id,
      value: tile.value,
      cell: tile.cell,
    })),
  };
  localStorage.setItem(KEY_GAME, JSON.stringify(payload));
}
