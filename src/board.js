export const SIZE = 4;
export const TileStatus = Object.freeze({
  IDLE: "idle",
  NEW: "new",
  MERGED: "merged",
  REMOVED: "removed",
});

export class Tile {
  constructor(id, value, cell) {
    this.id = id;
    this.value = value;
    this.cell = cell;
    this.prevCell = null;
    this.mergedFrom = null;
    this.status = TileStatus.IDLE;
  }

  static fromSnapshot(data) {
    return new Tile(data.id, data.value, data.cell);
  }

  prepareForTurn() {
    this.prevCell = this.cell;
    this.mergedFrom = null;
    this.status = TileStatus.IDLE;
  }

  markNew() {
    this.status = TileStatus.NEW;
  }

  markMerged(mergedFrom) {
    this.mergedFrom = mergedFrom;
    this.status = TileStatus.MERGED;
  }

  markRemoved() {
    this.status = TileStatus.REMOVED;
  }

  clearTransient() {
    this.prevCell = null;
    this.mergedFrom = null;
    this.status = TileStatus.IDLE;
  }

  isNew() {
    return this.status === TileStatus.NEW;
  }

  isMerged() {
    return this.status === TileStatus.MERGED;
  }

  isRemoved() {
    return this.status === TileStatus.REMOVED;
  }
}

export function createEmptyState() {
  return {
    size: SIZE,
    boardCells: Array(SIZE * SIZE).fill(null),
    tiles: new Map(),
    nextTileId: 1,
    score: 0,
    startTime: 0,
    elapsedMs: 0,
    bestRecord: null,
    isGameOver: false,
    isAnimating: false,
    undoStack: [],
  };
}

export function createTile(state, cell, value) {
  const tile = new Tile(state.nextTileId++, value, cell);
  state.tiles.set(tile.id, tile);
  state.boardCells[cell] = tile.id;
  return tile;
}

export function restoreFromSave(state, saved) {
  state.size = saved.size || SIZE;
  state.boardCells = Array.from(saved.boardCells || Array(state.size * state.size).fill(null));
  state.tiles = new Map();
  (saved.tiles || []).forEach((t) => {
    state.tiles.set(t.id, Tile.fromSnapshot(t));
  });
  state.nextTileId = saved.nextTileId || 1;
  state.score = saved.score || 0;
  state.elapsedMs = saved.elapsedMs || 0;
  state.startTime = saved.startTime || 0;
  state.isGameOver = false;
  state.isAnimating = false;
  state.undoStack = [];
}

export function addRandomTile(state) {
  const empties = [];
  for (let i = 0; i < state.boardCells.length; i += 1) {
    if (state.boardCells[i] === null) empties.push(i);
  }
  if (empties.length === 0) return null;
  const cell = empties[Math.floor(Math.random() * empties.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const tile = createTile(state, cell, value);
  tile.markNew();
  return tile;
}

export function getCell(row, col) {
  return row * SIZE + col;
}

function getLines(dir) {
  const lines = [];
  if (dir === "left" || dir === "right") {
    for (let r = 0; r < SIZE; r += 1) {
      const line = [];
      for (let c = 0; c < SIZE; c += 1) {
        const col = dir === "right" ? SIZE - 1 - c : c;
        line.push(getCell(r, col));
      }
      lines.push(line);
    }
  } else {
    for (let c = 0; c < SIZE; c += 1) {
      const line = [];
      for (let r = 0; r < SIZE; r += 1) {
        const row = dir === "down" ? SIZE - 1 - r : r;
        line.push(getCell(row, c));
      }
      lines.push(line);
    }
  }
  return lines;
}

export function moveTiles(state, dir) {
  const lines = getLines(dir);
  let moved = false;
  let scoreGain = 0;
  const mergedOutIds = new Set();
  const mergedTo = new Map();

  state.tiles.forEach((tile) => {
    tile.prepareForTurn();
  });

  const newBoard = Array(SIZE * SIZE).fill(null);

  lines.forEach((line) => {
    const ids = line.map((idx) => state.boardCells[idx]).filter((id) => id !== null);
    const result = [];
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      const tile = state.tiles.get(id);
      if (tile === undefined) continue;
      const nextId = ids[i + 1];
      if (nextId !== undefined) {
        const nextTile = state.tiles.get(nextId);
        if (nextTile && nextTile.value === tile.value) {
          const base = tile.value;
          tile.value = base * 2;
          tile.markMerged([id, nextId]);
          nextTile.markRemoved();
          mergedOutIds.add(nextId);
          mergedTo.set(nextId, id);
          scoreGain += tile.value;
          result.push(id);
          i += 1;
          continue;
        }
      }
      result.push(id);
    }

    result.forEach((id, index) => {
      const cell = line[index];
      const tile = state.tiles.get(id);
      if (!tile) return;
      tile.cell = cell;
      if (tile.prevCell !== tile.cell) moved = true;
      if (tile.mergedFrom) moved = true;
      newBoard[cell] = id;
    });
  });

  mergedOutIds.forEach((id) => {
    const targetId = mergedTo.get(id);
    const targetTile = targetId ? state.tiles.get(targetId) : null;
    const tile = state.tiles.get(id);
    if (!tile || !targetTile) return;
    tile.cell = targetTile.cell;
  });

  state.boardCells = newBoard;
  state.score += scoreGain;

  return { moved, scoreGain };
}

export function canMove(state) {
  if (state.boardCells.some((cell) => cell === null)) return true;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const cell = getCell(r, c);
      const id = state.boardCells[cell];
      const tile = state.tiles.get(id);
      if (!tile) continue;
      const right = c + 1 < SIZE ? state.tiles.get(state.boardCells[getCell(r, c + 1)]) : null;
      const down = r + 1 < SIZE ? state.tiles.get(state.boardCells[getCell(r + 1, c)]) : null;
      if (right && right.value === tile.value) return true;
      if (down && down.value === tile.value) return true;
    }
  }
  return false;
}

export function snapshotState(state) {
  return {
    boardCells: Array.from(state.boardCells),
    tiles: Array.from(state.tiles.values()).map((tile) => ({
      id: tile.id,
      value: tile.value,
      cell: tile.cell,
    })),
    score: state.score,
    elapsedMs: state.elapsedMs,
    startTime: state.startTime,
    nextTileId: state.nextTileId,
  };
}

export function restoreSnapshot(state, snapshot) {
  state.boardCells = Array.from(snapshot.boardCells);
  state.tiles = new Map();
  snapshot.tiles.forEach((tile) => {
    state.tiles.set(tile.id, Tile.fromSnapshot(tile));
  });
  state.score = snapshot.score;
  state.elapsedMs = snapshot.elapsedMs;
  state.startTime = snapshot.startTime;
  state.nextTileId = snapshot.nextTileId;
  state.isGameOver = false;
}

export function clearTileTransientState(state) {
  state.tiles.forEach((tile) => {
    if (!tile.isRemoved()) {
      tile.clearTransient();
    }
  });
}
