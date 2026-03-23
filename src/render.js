import { SIZE } from "./board.js";
import {
  applyTileStateClasses,
  colorForTileValue,
  fontSizeForTileValue,
  formatTileValue,
  renderTileLabel,
} from "./tile-view.js";

export function createRenderer(boardEl, overlayEl) {
  const tileNodes = new Map();
  let cellPositions = [];
  let measuredBoardWidth = 0;
  let measuredTileSize = 72;

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
    measuredTileSize = cells[0].getBoundingClientRect().width || measuredTileSize;
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
      const display = formatTileValue(tile.value);
      renderTileLabel(node, display);
      node.style.background = colorForTileValue(tile.value);
      node.style.fontSize = fontSizeForTileValue(display, measuredTileSize);

      const { x, y } = getTranslate(tile.cell);
      node.style.setProperty("--x", `${x}px`);
      node.style.setProperty("--y", `${y}px`);

      applyTileStateClasses(node, tile);
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
