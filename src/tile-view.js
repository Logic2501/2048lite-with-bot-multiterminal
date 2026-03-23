export function formatTileValue(value) {
  if (value < 100000) return { text: String(value), isPow: false };
  const exp = Math.round(Math.log2(value));
  return { text: `2^${exp}`, isPow: true, exp };
}

export function colorForTileValue(value) {
  const exp = Math.max(1, Math.round(Math.log2(value)));
  const base = 92;
  let light = base;
  if (exp <= 13) {
    light = Math.max(38, base - exp * 4.2);
  } else {
    light = Math.max(34, base - 13 * 4.2 - (exp - 13) * 1.2);
  }
  return `hsl(34, 20%, ${light}%)`;
}

export function fontSizeForTileValue(display, tileSize) {
  const base = Math.max(14, Math.min(34, tileSize * 0.36));
  const len = display.isPow ? String(display.exp).length + 1 : display.text.length;
  if (len <= 2) return `${base}px`;
  if (len <= 3) return `${base * 0.88}px`;
  if (len <= 4) return `${base * 0.78}px`;
  return `${base * 0.68}px`;
}

export function renderTileLabel(node, display) {
  if (display.isPow) {
    node.innerHTML = `2<span class="exp">${display.exp}</span>`;
    return;
  }
  node.textContent = display.text;
}

export function applyTileStateClasses(node, tile) {
  node.classList.remove("new");
  node.classList.remove("merge");
  node.classList.remove("no-anim");
  if (tile.isNew()) {
    node.classList.add("new");
    node.classList.add("no-anim");
  }
  if (tile.isMerged()) {
    node.classList.add("merge");
  }
}
