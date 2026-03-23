const DIRS = ["up", "left", "right", "down"];
const DEFAULT_DELAY_MS = 180;
const MIN_DELAY_MS = 150;
const MAX_DELAY_MS = 360;
const DELAY_STEP_MS = 20;
const GRADIENT_WEIGHTS = [
  [15, 14, 13, 12],
  [8, 9, 10, 11],
  [7, 6, 5, 4],
  [0, 1, 2, 3],
];

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

function countEmpty(cells) {
  let count = 0;
  cells.forEach((value) => {
    if (value === 0) count += 1;
  });
  return count;
}

function maxTile(cells) {
  let max = 0;
  cells.forEach((value) => {
    if (value > max) max = value;
  });
  return max;
}

function logValue(value) {
  return value > 0 ? Math.log2(value) : 0;
}

function gradientScore(cells, size) {
  let score = 0;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      score += logValue(cells[row * size + col]) * GRADIENT_WEIGHTS[row][col];
    }
  }
  return score;
}

function reversePenalty(cells, size) {
  let penalty = 0;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const current = logValue(cells[row * size + col]);
      const next = logValue(cells[row * size + col + 1]);
      if (current < next) {
        penalty += next - current;
      }
    }
  }
  for (let col = 0; col < size; col += 1) {
    for (let row = 0; row < size - 1; row += 1) {
      const current = logValue(cells[row * size + col]);
      const next = logValue(cells[(row + 1) * size + col]);
      if (current < next) {
        penalty += next - current;
      }
    }
  }
  return penalty;
}

function cornerDistancePenalty(cells, size) {
  const max = maxTile(cells);
  if (max === 0) return 0;
  const maxIndex = cells.indexOf(max);
  const row = Math.floor(maxIndex / size);
  const col = maxIndex % size;
  return (row + col) * logValue(max);
}

function cornerBroken(cells, size) {
  const corner = cells[0];
  const max = maxTile(cells);
  if (corner !== max) return true;
  const right = cells[1] || 0;
  const down = cells[size] || 0;
  return right > corner || down > corner;
}

function cornerBreakPenalty(cells, size) {
  if (!cornerBroken(cells, size)) return 0;
  let penalty = 1;
  for (let col = 0; col < size - 1; col += 1) {
    const current = cells[col];
    const next = cells[col + 1];
    if (current < next) penalty += next - current;
  }
  for (let row = 0; row < size - 1; row += 1) {
    const current = cells[row * size];
    const next = cells[(row + 1) * size];
    if (current < next) penalty += next - current;
  }
  return penalty;
}

function mergePotential(cells, size) {
  let merges = 0;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const value = cells[row * size + col];
      if (value === 0) continue;
      if (col + 1 < size && cells[row * size + col + 1] === value) {
        merges += logValue(value);
      }
      if (row + 1 < size && cells[(row + 1) * size + col] === value) {
        merges += logValue(value);
      }
    }
  }
  return merges;
}

function recoveryScore(beforeCells, afterCells, size) {
  if (!cornerBroken(beforeCells, size)) return 0;
  const distanceGain =
    cornerDistancePenalty(beforeCells, size) - cornerDistancePenalty(afterCells, size);
  const reverseGain = reversePenalty(beforeCells, size) - reversePenalty(afterCells, size);
  const gradientGain = gradientScore(afterCells, size) - gradientScore(beforeCells, size);
  const unbrokenBonus = cornerBroken(afterCells, size) ? 0 : 6;
  return distanceGain * 2 + reverseGain + gradientGain * 0.12 + unbrokenBonus;
}

function evaluate(snapshot, result) {
  const gradient = gradientScore(result.cells, snapshot.size);
  const reverse = reversePenalty(result.cells, snapshot.size);
  const cornerDistance = cornerDistancePenalty(result.cells, snapshot.size);
  const cornerBreak = cornerBreakPenalty(result.cells, snapshot.size);
  const empty = countEmpty(result.cells);
  const merge = mergePotential(result.cells, snapshot.size);
  const recovery = recoveryScore(snapshot.cells, result.cells, snapshot.size);
  return (
    4 * gradient -
    8 * reverse -
    40 * cornerDistance -
    120 * cornerBreak +
    12 * empty +
    6 * merge +
    30 * recovery
  );
}

export function chooseBotMove(snapshot) {
  if (!snapshot || snapshot.isGameOver) return null;

  let best = null;
  DIRS.forEach((dir, index) => {
    const result = simulateMove(snapshot, dir);
    if (!result.moved) return;
    const score = evaluate(snapshot, result) - index * 0.001;
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
