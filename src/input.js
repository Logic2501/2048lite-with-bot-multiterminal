const KEY_MAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

export function bindInput(targetEl, { onMove, onUndo, onToggleRecord }) {
  let touchStart = null;
  const threshold = 28;

  const handleKey = (event) => {
    if (event.repeat) return;
    if (event.code === "KeyZ" || event.code === "Backspace") {
      event.preventDefault();
      if (onUndo) onUndo();
      return;
    }
    if (event.code === "KeyR") {
      event.preventDefault();
      if (onToggleRecord) onToggleRecord();
      return;
    }
    const dir = KEY_MAP[event.code];
    if (!dir) return;
    event.preventDefault();
    onMove(dir);
  };

  const handleTouchStart = (event) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < threshold && absY < threshold) return;
    if (absX > absY) {
      onMove(dx > 0 ? "right" : "left");
    } else {
      onMove(dy > 0 ? "down" : "up");
    }
  };

  window.addEventListener("keydown", handleKey, { passive: false });
  targetEl.addEventListener("touchstart", handleTouchStart, { passive: true });
  targetEl.addEventListener("touchend", handleTouchEnd, { passive: true });

  return () => {
    window.removeEventListener("keydown", handleKey);
    targetEl.removeEventListener("touchstart", handleTouchStart);
    targetEl.removeEventListener("touchend", handleTouchEnd);
  };
}
