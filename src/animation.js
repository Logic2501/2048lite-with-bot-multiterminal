let activeTimer = null;

export function runAnimation(state, duration, onDone) {
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  state.isAnimating = true;
  activeTimer = setTimeout(() => {
    state.isAnimating = false;
    activeTimer = null;
    if (onDone) onDone();
  }, duration);
}

export function cancelAnimation(state) {
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  state.isAnimating = false;
}
