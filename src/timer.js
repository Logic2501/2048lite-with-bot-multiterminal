export function startTimer(state) {
  state.startTime = Date.now();
}

export function updateElapsed(state) {
  if (state.startTime === 0) return;
  state.elapsedMs = Date.now() - state.startTime;
}

export function resetTimer(state) {
  state.startTime = Date.now();
  state.elapsedMs = 0;
}

export function restoreTimer(state, elapsedMs) {
  state.elapsedMs = elapsedMs || 0;
  state.startTime = Date.now() - state.elapsedMs;
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
