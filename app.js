const STORAGE_KEY = "office-time-tracker-v1";
const TAB_STORAGE_KEY = "office-time-tracker-tab-v1";
const DEFAULT_POMODORO = {
  focusMinutes: 25,
  breakMinutes: 5,
  mode: "focus",
  remainingMs: 25 * 60 * 1000,
  running: false,
  lastTickMs: null,
  completedFocusSessions: 0,
};

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
const pomodoroModeEl = document.getElementById("pomodoroMode");
const pomodoroTimerEl = document.getElementById("pomodoroTimer");
const focusMinutesInputEl = document.getElementById("focusMinutesInput");
const breakMinutesInputEl = document.getElementById("breakMinutesInput");
const pomodoroStartBtn = document.getElementById("pomodoroStartBtn");
const pomodoroPauseBtn = document.getElementById("pomodoroPauseBtn");
const pomodoroResetBtn = document.getElementById("pomodoroResetBtn");
const pomodoroCompletedEl = document.getElementById("pomodoroCompleted");
const officeTabBtn = document.getElementById("officeTabBtn");
const pomodoroTabBtn = document.getElementById("pomodoroTabBtn");
const weatherTabBtn = document.getElementById("weatherTabBtn");
const trafficTabBtn = document.getElementById("trafficTabBtn");
const officeTabPanel = document.getElementById("officeTabPanel");
const pomodoroTabPanel = document.getElementById("pomodoroTabPanel");
const weatherTabPanel = document.getElementById("weatherTabPanel");
const trafficTabPanel = document.getElementById("trafficTabPanel");
const refreshWeatherBtn = document.getElementById("refreshWeatherBtn");
const weatherUpdatedEl = document.getElementById("weatherUpdated");
const dublinTempEl = document.getElementById("dublinTemp");
const dublinWindEl = document.getElementById("dublinWind");
const dublinCodeEl = document.getElementById("dublinCode");
const dunTempEl = document.getElementById("dunTemp");
const dunWindEl = document.getElementById("dunWind");
const dunCodeEl = document.getElementById("dunCode");
const dublinHourlyEl = document.getElementById("dublinHourly");
const dublinDailyEl = document.getElementById("dublinDaily");
const dunHourlyEl = document.getElementById("dunHourly");
const dunDailyEl = document.getElementById("dunDaily");

let state = loadState();
let timerInterval = null;
let pomodoroInterval = null;
let activeTab = loadActiveTab();

function loadActiveTab() {
  const tab = localStorage.getItem(TAB_STORAGE_KEY);
  const allowed = new Set(["office", "pomodoro", "weather", "traffic"]);
  return allowed.has(tab) ? tab : "office";
}

function saveActiveTab(tab) {
  localStorage.setItem(TAB_STORAGE_KEY, tab);
}

function renderTabs() {
  officeTabBtn.classList.toggle("active", activeTab === "office");
  pomodoroTabBtn.classList.toggle("active", activeTab === "pomodoro");
  weatherTabBtn.classList.toggle("active", activeTab === "weather");
  trafficTabBtn.classList.toggle("active", activeTab === "traffic");

  officeTabPanel.classList.toggle("hidden", activeTab !== "office");
  pomodoroTabPanel.classList.toggle("hidden", activeTab !== "pomodoro");
  weatherTabPanel.classList.toggle("hidden", activeTab !== "weather");
  trafficTabPanel.classList.toggle("hidden", activeTab !== "traffic");
}

function setActiveTab(tab) {
  const allowed = new Set(["office", "pomodoro", "weather", "traffic"]);
  activeTab = allowed.has(tab) ? tab : "office";
  saveActiveTab(activeTab);
  renderTabs();
}

function weatherCodeToText(code) {
  const table = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Showers",
    82: "Heavy showers",
    95: "Thunderstorm",
  };
  return table[code] || `Code ${code}`;
}

function setWeatherCard(tempEl, windEl, codeEl, payload) {
  if (!payload?.current) {
    tempEl.textContent = "--";
    windEl.textContent = "--";
    codeEl.textContent = "--";
    return;
  }

  tempEl.textContent = `${payload.current.temperature_2m}°C`;
  windEl.textContent = `${payload.current.wind_speed_10m} km/h`;
  codeEl.textContent = weatherCodeToText(payload.current.weather_code);
}

function formatHourLabel(isoTime) {
  const dt = new Date(isoTime);
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(isoDate) {
  const dt = new Date(`${isoDate}T00:00:00`);
  return dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function renderHourly(containerEl, payload) {
  const times = payload?.hourly?.time;
  const temps = payload?.hourly?.temperature_2m;
  const codes = payload?.hourly?.weather_code;

  if (!times || !temps || !codes || times.length === 0) {
    containerEl.innerHTML = '<p class="message">No hourly data.</p>';
    return;
  }

  let start = times.findIndex((t) => new Date(t).getTime() >= Date.now());
  if (start < 0) start = 0;
  const end = Math.min(start + 24, times.length);

  containerEl.innerHTML = times
    .slice(start, end)
    .map((time, idx) => {
      const i = start + idx;
      return `<div class="hour-item"><strong>${formatHourLabel(time)}</strong>${Math.round(
        temps[i]
      )}°C<br>${weatherCodeToText(codes[i])}</div>`;
    })
    .join("");
}

function renderDaily(containerEl, payload) {
  const times = payload?.daily?.time;
  const max = payload?.daily?.temperature_2m_max;
  const min = payload?.daily?.temperature_2m_min;
  const codes = payload?.daily?.weather_code;

  if (!times || !max || !min || !codes || times.length < 2) {
    containerEl.innerHTML = '<p class="message">No daily data.</p>';
    return;
  }

  const start = 1;
  const end = Math.min(start + 2, times.length);

  containerEl.innerHTML = times
    .slice(start, end)
    .map((day, idx) => {
      const i = start + idx;
      return `<div class="day-item"><strong>${formatDayLabel(day)}</strong>${Math.round(
        max[i]
      )}° / ${Math.round(min[i])}°<br>${weatherCodeToText(codes[i])}</div>`;
    })
    .join("");
}

async function fetchWeather() {
  refreshWeatherBtn.disabled = true;
  weatherUpdatedEl.textContent = "Refreshing weather...";

  const dublin4 =
    "https://api.open-meteo.com/v1/forecast?latitude=53.3244&longitude=-6.2317&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3";
  const dunshaughlin =
    "https://api.open-meteo.com/v1/forecast?latitude=53.5123&longitude=-6.5409&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3";

  try {
    const [dublinRes, dunRes] = await Promise.all([fetch(dublin4), fetch(dunshaughlin)]);
    if (!dublinRes.ok || !dunRes.ok) {
      throw new Error("Weather service unavailable");
    }

    const [dublinData, dunData] = await Promise.all([dublinRes.json(), dunRes.json()]);
    setWeatherCard(dublinTempEl, dublinWindEl, dublinCodeEl, dublinData);
    setWeatherCard(dunTempEl, dunWindEl, dunCodeEl, dunData);
    renderHourly(dublinHourlyEl, dublinData);
    renderHourly(dunHourlyEl, dunData);
    renderDaily(dublinDailyEl, dublinData);
    renderDaily(dunDailyEl, dunData);
    weatherUpdatedEl.textContent = `Updated at ${new Date().toLocaleString()}`;
  } catch {
    weatherUpdatedEl.textContent = "Could not load weather right now.";
    dublinHourlyEl.innerHTML = '<p class="message">Unavailable</p>';
    dunHourlyEl.innerHTML = '<p class="message">Unavailable</p>';
    dublinDailyEl.innerHTML = '<p class="message">Unavailable</p>';
    dunDailyEl.innerHTML = '<p class="message">Unavailable</p>';
  } finally {
    refreshWeatherBtn.disabled = false;
  }
}

function normalizeMinutes(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

function normalizePomodoro(raw) {
  const focusMinutes = normalizeMinutes(raw?.focusMinutes, DEFAULT_POMODORO.focusMinutes);
  const breakMinutes = normalizeMinutes(raw?.breakMinutes, DEFAULT_POMODORO.breakMinutes);
  const mode = raw?.mode === "break" ? "break" : "focus";
  const maxRemaining = (mode === "focus" ? focusMinutes : breakMinutes) * 60 * 1000;
  const remainingMs =
    Number.isFinite(raw?.remainingMs) && raw.remainingMs > 0
      ? Math.min(raw.remainingMs, maxRemaining)
      : maxRemaining;

  return {
    focusMinutes,
    breakMinutes,
    mode,
    remainingMs,
    running: Boolean(raw?.running),
    lastTickMs: Number.isFinite(raw?.lastTickMs) ? raw.lastTickMs : null,
    completedFocusSessions: Number.isFinite(raw?.completedFocusSessions)
      ? Math.max(0, Math.floor(raw.completedFocusSessions))
      : 0,
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { activeStart: null, sessions: [], pomodoro: normalizePomodoro(null) };
  }

  try {
    const parsed = JSON.parse(raw);
    const pomodoro = normalizePomodoro(parsed.pomodoro);

    if (pomodoro.running && pomodoro.lastTickMs) {
      const elapsedMs = Math.max(0, nowMs() - pomodoro.lastTickMs);
      applyPomodoroElapsed(pomodoro, elapsedMs);
      pomodoro.lastTickMs = nowMs();
    }

    return {
      activeStart: parsed.activeStart || null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      pomodoro,
    };
  } catch {
    return { activeStart: null, sessions: [], pomodoro: normalizePomodoro(null) };
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

function pomodoroDurationMs(pomodoro, mode) {
  const minutes = mode === "focus" ? pomodoro.focusMinutes : pomodoro.breakMinutes;
  return minutes * 60 * 1000;
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function applyPomodoroElapsed(pomodoro, elapsedMs) {
  let remaining = elapsedMs;
  while (remaining > 0) {
    if (remaining >= pomodoro.remainingMs) {
      remaining -= pomodoro.remainingMs;
      if (pomodoro.mode === "focus") {
        pomodoro.completedFocusSessions += 1;
      }
      pomodoro.mode = pomodoro.mode === "focus" ? "break" : "focus";
      pomodoro.remainingMs = pomodoroDurationMs(pomodoro, pomodoro.mode);
      continue;
    }

    pomodoro.remainingMs -= remaining;
    remaining = 0;
  }
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
  statusEl.className = inOffice ? "status-pill in-office" : "status-pill out-office";
  startBtn.disabled = inOffice;
  stopBtn.disabled = !inOffice;

  updateLiveTimer();

  const summary = aggregateWeek();
  weekTotalEl.textContent = formatShort(summary.totalMs);
  avgDayWorkedEl.textContent = formatShort(summary.avgPerWorkedDay);
  avgDayWeekEl.textContent = formatShort(summary.avgPerWeekDay);
  avgSessionEl.textContent = formatShort(summary.avgSession);

  renderSessions();
  renderPomodoro();
}

function renderPomodoro() {
  const { pomodoro } = state;
  const isFocus = pomodoro.mode === "focus";

  pomodoroModeEl.textContent = isFocus ? "Focus" : "Break";
  pomodoroModeEl.className = isFocus ? "status-pill in-office" : "status-pill out-office";
  pomodoroTimerEl.textContent = formatCountdown(pomodoro.remainingMs);
  pomodoroCompletedEl.textContent = String(pomodoro.completedFocusSessions);

  focusMinutesInputEl.value = String(pomodoro.focusMinutes);
  breakMinutesInputEl.value = String(pomodoro.breakMinutes);
  focusMinutesInputEl.disabled = pomodoro.running;
  breakMinutesInputEl.disabled = pomodoro.running;

  pomodoroStartBtn.disabled = pomodoro.running;
  pomodoroPauseBtn.disabled = !pomodoro.running;
  pomodoroStartBtn.textContent = isFocus ? "Start Focus" : "Start Break";
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

function startPomodoroInterval() {
  stopPomodoroInterval();
  pomodoroInterval = setInterval(() => {
    if (!state.pomodoro.running || !state.pomodoro.lastTickMs) return;

    const now = nowMs();
    const elapsed = Math.max(0, now - state.pomodoro.lastTickMs);
    if (elapsed === 0) return;

    applyPomodoroElapsed(state.pomodoro, elapsed);
    state.pomodoro.lastTickMs = now;
    saveState();
    renderPomodoro();
  }, 1000);
}

function stopPomodoroInterval() {
  if (pomodoroInterval) {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
  }
}

function startPomodoro() {
  if (state.pomodoro.running) return;
  state.pomodoro.running = true;
  state.pomodoro.lastTickMs = nowMs();
  saveState();
  renderPomodoro();
  startPomodoroInterval();
}

function pausePomodoro() {
  if (!state.pomodoro.running) return;

  const now = nowMs();
  const elapsed = Math.max(0, now - (state.pomodoro.lastTickMs || now));
  applyPomodoroElapsed(state.pomodoro, elapsed);
  state.pomodoro.running = false;
  state.pomodoro.lastTickMs = null;
  saveState();
  renderPomodoro();
  stopPomodoroInterval();
}

function resetPomodoro() {
  const focusMinutes = normalizeMinutes(focusMinutesInputEl.value, state.pomodoro.focusMinutes);
  const breakMinutes = normalizeMinutes(breakMinutesInputEl.value, state.pomodoro.breakMinutes);
  state.pomodoro = {
    focusMinutes,
    breakMinutes,
    mode: "focus",
    remainingMs: focusMinutes * 60 * 1000,
    running: false,
    lastTickMs: null,
    completedFocusSessions: 0,
  };
  saveState();
  renderPomodoro();
  stopPomodoroInterval();
}

function applyPomodoroSettings() {
  if (state.pomodoro.running) return;

  state.pomodoro.focusMinutes = normalizeMinutes(
    focusMinutesInputEl.value,
    state.pomodoro.focusMinutes
  );
  state.pomodoro.breakMinutes = normalizeMinutes(
    breakMinutesInputEl.value,
    state.pomodoro.breakMinutes
  );
  state.pomodoro.remainingMs = pomodoroDurationMs(state.pomodoro, state.pomodoro.mode);
  saveState();
  renderPomodoro();
}

startBtn.addEventListener("click", startSession);
stopBtn.addEventListener("click", stopSession);
pomodoroStartBtn.addEventListener("click", startPomodoro);
pomodoroPauseBtn.addEventListener("click", pausePomodoro);
pomodoroResetBtn.addEventListener("click", resetPomodoro);
focusMinutesInputEl.addEventListener("change", applyPomodoroSettings);
breakMinutesInputEl.addEventListener("change", applyPomodoroSettings);
officeTabBtn.addEventListener("click", () => setActiveTab("office"));
pomodoroTabBtn.addEventListener("click", () => setActiveTab("pomodoro"));
weatherTabBtn.addEventListener("click", () => setActiveTab("weather"));
trafficTabBtn.addEventListener("click", () => setActiveTab("traffic"));
refreshWeatherBtn.addEventListener("click", fetchWeather);

render();
renderTabs();
fetchWeather();
if (state.activeStart) beginInterval();
if (state.pomodoro.running) startPomodoroInterval();
