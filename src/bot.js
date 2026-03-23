const DIRS = ["up", "left", "right", "down"];
const DEFAULT_DELAY_MS = 180;
const MIN_DELAY_MS = 150;
const MAX_DELAY_MS = 360;
const DELAY_STEP_MS = 20;

function buildLines(size, dir) {
  const lines = [];
  if (dir === "left" || dir === "right") {
    for (let row = 0; row < size; row += 1) {
      const line = [];
      for (let col = 0; col < size; col += 1) {
        const actualCol = dir === "right" ? size - 1 - col : col;
        line.push(row * size + actualCol);
      }
      lines.push(line);
    }
  } else {
    for (let col = 0; col < size; col += 1) {
      const line = [];
      for (let row = 0; row < size; row += 1) {
        const actualRow = dir === "down" ? size - 1 - row : row;
        line.push(actualRow * size + col);
      }
      lines.push(line);
    }
  }
  return lines;
}

function simulateMove(snapshot, dir) {
  const size = snapshot.size;
  const nextCells = Array.from(snapshot.cells);
  let moved = false;
  let scoreGain = 0;

  buildLines(size, dir).forEach((line) => {
    const values = line.map((index) => nextCells[index]).filter((value) => value !== 0);
    const compacted = [];

    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      if (i + 1 < values.length && values[i + 1] === value) {
        const merged = value * 2;
        compacted.push(merged);
        scoreGain += merged;
        i += 1;
      } else {
        compacted.push(value);
      }
    }

    for (let i = 0; i < line.length; i += 1) {
      const nextValue = compacted[i] || 0;
      const cellIndex = line[i];
      if (nextCells[cellIndex] !== nextValue) {
        moved = true;
      }
      nextCells[cellIndex] = nextValue;
    }
  });

  return { moved, cells: nextCells, scoreGain };
}

function cellsToBoard(cells, size) {
  const board = [];
  for (let row = 0; row < size; row += 1) {
    const start = row * size;
    board.push(cells.slice(start, start + size).map((value) => value || 0));
  }
  return board;
}

function inversePenalty(leftOrTop, rightOrBottom, weight) {
  if (leftOrTop === 0 && rightOrBottom === 0) return 0;
  if (leftOrTop >= rightOrBottom) return 0;
  const p = leftOrTop > 0 ? Math.log2(leftOrTop) : 0;
  const q = rightOrBottom > 0 ? Math.log2(rightOrBottom) : 0;
  const diff = q - p;
  return weight * diff * diff;
}

function coreOccupancyScore(board, topTiles) {
  const coreWeights = new Map([
    ["0,0", 2600],
    ["0,1", 1800],
    ["1,0", 1800],
    ["0,2", 1100],
    ["2,0", 1100],
  ]);

  const topSet = new Set(topTiles.slice(0, 5).map((t) => `${t.r},${t.c}`));
  let score = 0;

  for (const [key, weight] of coreWeights.entries()) {
    const [r, c] = key.split(",").map(Number);
    const value = board[r][c] || 0;

    if (topSet.has(key)) {
      score += weight * (value > 0 ? Math.log2(value) : 0);
    }

    if (value === 0) {
      score -= weight * 1.6;
    }

    if (value > 0 && value <= 8) {
      score -= weight * 0.8;
    }
  }

  return score;
}

function nearAnchorHighValueScore(topTiles) {
  let score = 0;
  for (let i = 1; i < Math.min(topTiles.length, 5); i += 1) {
    const tile = topTiles[i];
    const key = `${tile.r},${tile.c}`;
    const lv = Math.log2(tile.v);

    if (key === "0,1" || key === "1,0") {
      score += 2400 * lv;
    } else if (key === "0,2" || key === "2,0") {
      score += 1400 * lv;
    }
  }
  return score;
}

function analyzeStructure(board) {
  const flat = [];
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      flat.push({ r, c, v: board[r][c] || 0 });
    }
  }

  const nonZero = flat.filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const topTiles = nonZero.slice(0, 5);

  const coreSet = new Set(["0,0", "0,1", "0,2", "1,0", "2,0"]);
  const centerSet = new Set(["1,1", "1,2", "2,1", "2,2"]);

  const maxTile = nonZero[0] || { r: 0, c: 0, v: 0 };
  const maxDistToCorner = maxTile.r + maxTile.c;

  const a = board[0][0] || 0;
  const b = board[0][1] || 0;
  const c = board[0][2] || 0;
  const d = board[1][0] || 0;
  const e = board[2][0] || 0;

  const coreInverse =
    inversePenalty(a, b, 1) +
    inversePenalty(a, d, 1) +
    inversePenalty(b, c, 1) +
    inversePenalty(d, e, 1) +
    inversePenalty(b, d, 1) +
    inversePenalty(c, e, 1);

  let topInCore = 0;
  let topInCenter = 0;
  let largeActiveBackToCore = 0;

  for (const t of topTiles) {
    const key = `${t.r},${t.c}`;
    if (coreSet.has(key)) topInCore += 1;
    if (centerSet.has(key)) topInCenter += 1;
    if (coreSet.has(key) && !(t.r === 0 && t.c === 0)) {
      largeActiveBackToCore += 1;
    }
  }

  return {
    maxDistToCorner,
    coreInverse,
    topInCore,
    topInCenter,
    largeActiveBackToCore,
  };
}

function evaluateBoard(board, prevBoard = null) {
  const flat = [];
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      flat.push({ r, c, v: board[r][c] || 0 });
    }
  }

  const nonZero = flat.filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const topTiles = nonZero.slice(0, 6);
  const maxTile = topTiles[0] || { r: 0, c: 0, v: 0 };

  const coreSet = new Set(["0,0", "0,1", "0,2", "1,0", "2,0"]);
  const centerSet = new Set(["1,1", "1,2", "2,1", "2,2"]);

  let score = 0;

  // 1) 最大数守角
  if (maxTile.r === 0 && maxTile.c === 0) {
    score += 5000;
  } else {
    const dist = maxTile.r + maxTile.c;
    score -= 4000 + dist * 1800;
  }

  // 2) 核心 5 格单调
  const a = board[0][0] || 0;
  const b = board[0][1] || 0;
  const c = board[0][2] || 0;
  const d = board[1][0] || 0;
  const e = board[2][0] || 0;

  score -= inversePenalty(a, b, 2600);
  score -= inversePenalty(a, d, 2600);
  score -= inversePenalty(b, c, 1600);
  score -= inversePenalty(d, e, 1600);
  score -= inversePenalty(b, d, 1200);
  score -= inversePenalty(c, e, 900);

  // 3) 核心 5 格占位质量
  score += coreOccupancyScore(board, topTiles);

  // 4) 中心禁区
  for (let i = 0; i < Math.min(topTiles.length, 5); i += 1) {
    const t = topTiles[i];
    const key = `${t.r},${t.c}`;
    if (centerSet.has(key)) {
      score -= 3200 * Math.log2(t.v);
    }
  }

  // 5) 大数贴近锚角边
  score += nearAnchorHighValueScore(topTiles);

  // 6) 活动空间
  const emptyCount = flat.filter((x) => x.v === 0).length;
  score += emptyCount * 120;

  // 7) 恢复趋势
  if (prevBoard) {
    const prevState = analyzeStructure(prevBoard);
    const currState = analyzeStructure(board);
    score += (prevState.coreInverse - currState.coreInverse) * 3200;
    score += (currState.topInCore - prevState.topInCore) * 2600;
    score +=
      (currState.largeActiveBackToCore - prevState.largeActiveBackToCore) * 2200;
    score += (prevState.topInCenter - currState.topInCenter) * 2600;
    score += (prevState.maxDistToCorner - currState.maxDistToCorner) * 2200;
  }

  return score;
}

export function chooseBotMove(snapshot) {
  if (!snapshot || snapshot.isGameOver) return null;

  let best = null;
  const prevBoard = cellsToBoard(snapshot.cells, snapshot.size);
  DIRS.forEach((dir, index) => {
    const result = simulateMove(snapshot, dir);
    if (!result.moved) return;
    const nextBoard = cellsToBoard(result.cells, snapshot.size);
    const score = evaluateBoard(nextBoard, prevBoard) - index * 0.001;
    if (!best || score > best.score) {
      best = { dir, score };
    }
  });

  return best ? best.dir : null;
}

export function createStrategyBot({
  getState,
  requestMove,
  onChange,
  delayMs = DEFAULT_DELAY_MS,
}) {
  let running = false;
  let timerId = null;
  let currentDelayMs = Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, delayMs));

  const emitChange = () => {
    if (onChange) {
      onChange({
        running,
        delayMs: currentDelayMs,
        minDelayMs: MIN_DELAY_MS,
        maxDelayMs: MAX_DELAY_MS,
      });
    }
  };

  const clearTimer = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  const schedule = () => {
    clearTimer();
    if (!running) return;
    timerId = window.setTimeout(tick, currentDelayMs);
  };

  const stop = () => {
    if (!running && timerId === null) return;
    running = false;
    clearTimer();
    emitChange();
  };

  const tick = () => {
    timerId = null;
    if (!running) return;
    const snapshot = getState();
    if (!snapshot || snapshot.isGameOver) {
      stop();
      return;
    }
    if (snapshot.isAnimating) {
      schedule();
      return;
    }
    const dir = chooseBotMove(snapshot);
    if (!dir) {
      stop();
      return;
    }
    requestMove(dir);
    schedule();
  };

  const start = () => {
    if (running) return;
    running = true;
    emitChange();
    schedule();
  };

  const toggle = () => {
    if (running) {
      stop();
    } else {
      start();
    }
  };

  return {
    start,
    stop,
    toggle,
    setDelay(nextDelayMs) {
      const normalized = Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, nextDelayMs));
      if (normalized === currentDelayMs) return currentDelayMs;
      currentDelayMs = normalized;
      emitChange();
      if (running) schedule();
      return currentDelayMs;
    },
    adjustDelay(deltaMs) {
      return this.setDelay(currentDelayMs + deltaMs);
    },
    getDelay() {
      return currentDelayMs;
    },
    getDelayConfig() {
      return {
        minDelayMs: MIN_DELAY_MS,
        maxDelayMs: MAX_DELAY_MS,
        stepMs: DELAY_STEP_MS,
      };
    },
    isRunning() {
      return running;
    },
  };
}

export { DEFAULT_DELAY_MS, MIN_DELAY_MS, MAX_DELAY_MS, DELAY_STEP_MS };
