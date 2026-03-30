const KEY_ACTIVE = "2048_expert_recording_active";
const KEY_ARCHIVE = "2048_expert_recording_sessions";
const MAX_SESSIONS = 24;

function loadJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function cloneState(state) {
  return {
    size: state.size,
    cells: Array.from(state.cells),
    score: state.score,
    elapsedMs: state.elapsedMs,
    isGameOver: state.isGameOver,
  };
}

function buildSession(initialState) {
  const now = Date.now();
  return {
    id: `expert-${now}-${Math.random().toString(36).slice(2, 8)}`,
    schemaVersion: 1,
    startedAt: now,
    updatedAt: now,
    initialState: cloneState(initialState),
    lastState: cloneState(initialState),
    steps: [],
  };
}

function archiveSession(session) {
  const sessions = loadJson(KEY_ARCHIVE, []);
  sessions.unshift(session);
  saveJson(KEY_ARCHIVE, sessions.slice(0, MAX_SESSIONS));
}

export function createExpertRecorder({ getState, onChange }) {
  let activeSession = loadJson(KEY_ACTIVE, null);

  const emitChange = () => {
    if (!onChange) return;
    onChange({
      recording: activeSession !== null,
      steps: activeSession ? activeSession.steps.length : 0,
      sessionId: activeSession ? activeSession.id : null,
    });
  };

  const persistActive = () => {
    if (activeSession) {
      activeSession.updatedAt = Date.now();
      saveJson(KEY_ACTIVE, activeSession);
    } else {
      localStorage.removeItem(KEY_ACTIVE);
    }
    emitChange();
  };

  const start = () => {
    if (activeSession) {
      return activeSession;
    }
    activeSession = buildSession(getState());
    persistActive();
    return activeSession;
  };

  const stop = (reason = "manual") => {
    if (!activeSession) return null;
    const finished = {
      ...activeSession,
      endedAt: Date.now(),
      stopReason: reason,
      finalState: cloneState(getState()),
    };
    archiveSession(finished);
    activeSession = null;
    persistActive();
    return finished;
  };

  const recordStep = ({ type, action = null, actor = "human", before, after, applied }) => {
    if (!activeSession) return;
    activeSession.steps.push({
      index: activeSession.steps.length,
      at: Date.now(),
      type,
      action,
      actor,
      applied,
      before: cloneState(before),
      after: cloneState(after),
    });
    activeSession.lastState = cloneState(after);
    persistActive();
  };

  emitChange();

  return {
    start,
    stop,
    recordStep,
    isRecording() {
      return activeSession !== null;
    },
    getActiveSession() {
      return activeSession;
    },
  };
}
