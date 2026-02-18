const STORAGE_KEY = "office-time-tracker-v1";

const statusEl = document.getElementById("status");
const liveTimerEl = document.getElementById("liveTimer");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const messageEl = document.getElementById("message");
const weekTotalEl = document.getElementById("weekTotal");
const avgDayWorkedEl = document.getElementById("avgDayWorked");
const avgDayWeekEl = document.getElementById("avgDayWeek");
const avgSessionEl = document.getElementById("avgSession");
const sessionListEl = document.getElementById("sessionList");

let state = loadState();
let timerInterval = null;

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { activeStart: null, sessions: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      activeStart: parsed.activeStart || null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return { activeStart: null, sessions: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatShort(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

function nowMs() {
  return Date.now();
}

function getWeekBounds(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  return { start: monday.getTime(), end: nextMonday.getTime() };
}

function getThisWeekSessions() {
  const { start, end } = getWeekBounds();
  return state.sessions.filter((s) => s.start >= start && s.start < end && s.end <= end);
}

function aggregateWeek() {
  const sessions = getThisWeekSessions();
  const activeMs = state.activeStart ? nowMs() - state.activeStart : 0;

  const totalMs = sessions.reduce((sum, s) => sum + (s.end - s.start), 0) + activeMs;

  const uniqueDaysWorked = new Set(
    sessions.map((s) => new Date(s.start).toDateString())
  );

  if (state.activeStart) {
    uniqueDaysWorked.add(new Date(state.activeStart).toDateString());
  }

  const workedDays = uniqueDaysWorked.size;
  const sessionCount = sessions.length + (state.activeStart ? 1 : 0);

  const avgPerWorkedDay = workedDays ? totalMs / workedDays : 0;
  const avgPerWeekDay = totalMs / 7;
  const avgSession = sessionCount ? totalMs / sessionCount : 0;

  return { totalMs, avgPerWorkedDay, avgPerWeekDay, avgSession, sessions };
}

function renderSessions() {
  const sessions = [...state.sessions]
    .sort((a, b) => b.start - a.start)
    .slice(0, 8);

  if (sessions.length === 0) {
    sessionListEl.innerHTML = '<li class="empty">No sessions recorded yet.</li>';
    return;
  }

  sessionListEl.innerHTML = sessions
    .map((s) => {
      const start = new Date(s.start);
      const end = new Date(s.end);
      const duration = formatShort(s.end - s.start);
      return `<li><strong>${start.toLocaleDateString()}</strong><br>${start.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })} - ${end.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })} (${duration})</li>`;
    })
    .join("");
}

function updateLiveTimer() {
  if (!state.activeStart) {
    liveTimerEl.textContent = "00:00:00";
    return;
  }

  liveTimerEl.textContent = formatDuration(nowMs() - state.activeStart);
}

function render() {
  const inOffice = Boolean(state.activeStart);

  statusEl.textContent = inOffice ? "In office" : "Not in office";
  startBtn.disabled = inOffice;
  stopBtn.disabled = !inOffice;

  updateLiveTimer();

  const summary = aggregateWeek();
  weekTotalEl.textContent = formatShort(summary.totalMs);
  avgDayWorkedEl.textContent = formatShort(summary.avgPerWorkedDay);
  avgDayWeekEl.textContent = formatShort(summary.avgPerWeekDay);
  avgSessionEl.textContent = formatShort(summary.avgSession);

  renderSessions();
}

function startSession() {
  if (state.activeStart) return;
  state.activeStart = nowMs();
  saveState();
  messageEl.textContent = `Started at ${new Date(state.activeStart).toLocaleTimeString()}`;
  render();
  beginInterval();
}

function stopSession() {
  if (!state.activeStart) return;

  const end = nowMs();
  const start = state.activeStart;
  if (end > start) {
    state.sessions.push({ start, end });
  }

  state.activeStart = null;
  saveState();
  messageEl.textContent = `Stopped at ${new Date(end).toLocaleTimeString()}`;
  render();
  stopInterval();
}

function beginInterval() {
  stopInterval();
  timerInterval = setInterval(() => {
    updateLiveTimer();
    const summary = aggregateWeek();
    weekTotalEl.textContent = formatShort(summary.totalMs);
    avgDayWorkedEl.textContent = formatShort(summary.avgPerWorkedDay);
    avgDayWeekEl.textContent = formatShort(summary.avgPerWeekDay);
    avgSessionEl.textContent = formatShort(summary.avgSession);
  }, 1000);
}

function stopInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

startBtn.addEventListener("click", startSession);
stopBtn.addEventListener("click", stopSession);

render();
if (state.activeStart) beginInterval();
