import { SIZE } from "./board.js";

export function createRenderer(boardEl, overlayEl) {
  const tileNodes = new Map();
  let cellPositions = [];
  let measuredBoardWidth = 0;

  const ensureCells = () => {
    const existing = boardEl.querySelectorAll(".cell");
    if (existing.length === SIZE * SIZE) return;
    boardEl.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      boardEl.appendChild(cell);
    }
  };

  const measure = () => {
    const cells = Array.from(boardEl.querySelectorAll(".cell"));
    const boardRect = boardEl.getBoundingClientRect();
    if (boardRect.width === 0 || cells.length !== SIZE * SIZE) {
      cellPositions = [];
      measuredBoardWidth = 0;
      return false;
    }
    cellPositions = cells.map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { x: rect.left - boardRect.left, y: rect.top - boardRect.top };
    });
    measuredBoardWidth = boardRect.width;
    return true;
  };

  const ensureMeasured = () => {
    const boardRect = boardEl.getBoundingClientRect();
    const invalid =
      cellPositions.length !== SIZE * SIZE ||
      measuredBoardWidth === 0 ||
      Math.abs(boardRect.width - measuredBoardWidth) > 0.5;
    if (invalid) {
      measure();
    }
  };

  const getTranslate = (cellIndex) => {
    ensureMeasured();
    return cellPositions[cellIndex] || { x: 0, y: 0 };
  };

  const formatValue = (value) => {
    if (value < 100000) return { text: String(value), isPow: false };
    const exp = Math.round(Math.log2(value));
    return { text: `2^${exp}`, isPow: true, exp };
  };

  const colorForValue = (value) => {
    const exp = Math.max(1, Math.round(Math.log2(value)));
    const base = 92;
    let light = base;
    if (exp <= 13) {
      light = Math.max(38, base - exp * 4.2);
    } else {
      light = Math.max(34, base - 13 * 4.2 - (exp - 13) * 1.2);
    }
    return `hsl(34, 20%, ${light}%)`;
  };

  const fontSizeForValue = (value) => {
    const base = parseFloat(getComputedStyle(boardEl).getPropertyValue("--tile-font")) || 20;
    const text = formatValue(value);
    if (text.length <= 3) return `${base}px`;
    if (text.length <= 4) return `${base * 0.9}px`;
    if (text.length <= 5) return `${base * 0.8}px`;
    return `${base * 0.7}px`;
  };

  const renderTiles = (state) => {
    const alive = new Set();
    state.tiles.forEach((tile) => {
      alive.add(tile.id);
      let node = tileNodes.get(tile.id);
      if (!node) {
        node = document.createElement("div");
        node.className = "tile";
        node.dataset.id = String(tile.id);
        boardEl.appendChild(node);
        tileNodes.set(tile.id, node);
      }
      const display = formatValue(tile.value);
      if (display.isPow) {
        node.innerHTML = `2<span class="exp">${display.exp}</span>`;
      } else {
        node.textContent = display.text;
      }
      node.style.background = colorForValue(tile.value);
      node.style.fontSize = fontSizeForValue(tile.value);

      const { x, y } = getTranslate(tile.cell);
      node.style.setProperty("--x", `${x}px`);
      node.style.setProperty("--y", `${y}px`);

      if (tile.isNew) node.classList.add("new");
      if (tile.isNew) node.classList.add("no-anim");
      if (tile.mergedFrom) node.classList.add("merge");
    });

    tileNodes.forEach((node, id) => {
      if (!alive.has(id)) {
        node.remove();
        tileNodes.delete(id);
      }
    });
  };

  const clearTransient = () => {
    tileNodes.forEach((node) => {
      node.classList.remove("new");
      node.classList.remove("merge");
      node.classList.remove("no-anim");
    });
  };

  const showGameOver = (show) => {
    if (!overlayEl) return;
    overlayEl.classList.toggle("hidden", !show);
  };

  ensureCells();
  measure();

  return {
    measure,
    render(state) {
      ensureMeasured();
      renderTiles(state);
      showGameOver(state.isGameOver);
    },
    clearTransient,
    showGameOver,
  };
}
