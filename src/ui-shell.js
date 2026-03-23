export function createUiShell({
  entryEl,
  gameEl,
  renderer,
  btnContinue,
  bestScoreEl,
  recordScoreEl,
  recordTimeEl,
  recordDateEl,
  loadCurrentGame,
  saveBestRecord,
  formatDuration,
}) {
  const updateEntryRecord = (record) => {
    if (!record || record.score === 0) {
      recordScoreEl.textContent = "--";
      recordTimeEl.textContent = "--";
      recordDateEl.textContent = "--";
      return;
    }
    recordScoreEl.textContent = record.score;
    recordTimeEl.textContent = formatDuration(record.durationMs);
    recordDateEl.textContent = new Date(record.timestamp).toLocaleString();
  };

  const updateBestScore = (record) => {
    bestScoreEl.textContent = record ? record.score : 0;
    updateEntryRecord(record);
    if (record) saveBestRecord(record);
  };

  const refreshContinue = () => {
    const current = loadCurrentGame();
    btnContinue.disabled = current === null;
  };

  const showEntry = () => {
    entryEl.classList.remove("hidden");
    gameEl.classList.add("hidden");
    renderer.showGameOver(false);
    refreshContinue();
  };

  const showGame = (state) => {
    entryEl.classList.add("hidden");
    gameEl.classList.remove("hidden");
    renderer.measure();
    renderer.render(state);
  };

  return {
    refreshContinue,
    showEntry,
    showGame,
    updateBestScore,
  };
}
