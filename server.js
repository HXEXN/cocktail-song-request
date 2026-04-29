const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const QRCode = require("qrcode");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

const clients = new Set();
const ANNOUNCEMENT_TYPES = new Set(["notice", "kitchen", "warning"]);
const GAME_EVENT_TYPES = new Set(["boss", "draw", "quiz", "table", "custom"]);
const RPS_CHOICES = new Set(["rock", "paper", "scissors"]);
const RPS_LABELS = {
  rock: "바위",
  paper: "보",
  scissors: "가위"
};
const THEME_KEYS = new Set([
  "normal",
  "birthday",
  "club",
  "department",
  "freshman",
  "exam",
  "couple",
  "farewell",
  "custom"
]);

const DEFAULT_KITCHEN_MESSAGE = "00시부터 주방 주문이 마감되어 추가 주문을 받을 수 없습니다. 추가 주문이 필요하시면 지금 직원에게 말씀해주세요.";

function defaultState() {
  return {
    requests: [],
    currentId: null,
    currentStartedAt: null,
    activeAnnouncement: null,
    announcementHistory: [],
    activeEvent: null,
    eventHistory: [],
    settings: {
      kitchenClose: {
        enabled: true,
        time: "00:00",
        title: "주방 마감 안내",
        message: DEFAULT_KITCHEN_MESSAGE,
        durationSeconds: 90,
        voiceEnabled: true,
        lastTriggeredDate: ""
      }
    },
    updatedAt: new Date().toISOString()
  };
}

function normalizeState(raw = {}) {
  const base = defaultState();
  const kitchenClose = {
    ...base.settings.kitchenClose,
    ...(raw.settings?.kitchenClose || {})
  };

  return {
    ...base,
    ...raw,
    requests: Array.isArray(raw.requests) ? raw.requests : [],
    activeAnnouncement: raw.activeAnnouncement || null,
    announcementHistory: Array.isArray(raw.announcementHistory) ? raw.announcementHistory.slice(-50) : [],
    activeEvent: raw.activeEvent || null,
    eventHistory: Array.isArray(raw.eventHistory) ? raw.eventHistory.slice(-50) : [],
    settings: {
      ...base.settings,
      ...(raw.settings || {}),
      kitchenClose
    }
  };
}

function ensureStateFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    writeState(defaultState());
  }
}

function loadState() {
  ensureStateFile();
  const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  return normalizeState(raw);
}

function writeState(state) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const nextState = { ...state, updatedAt: new Date().toISOString() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2));
  return nextState;
}

function saveAndBroadcast(state) {
  const nextState = writeState(state);
  broadcast(nextState);
  return nextState;
}

function publicState(state = loadState()) {
  const requests = [...state.requests].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const activeAnnouncement = isAnnouncementActive(state.activeAnnouncement) ? state.activeAnnouncement : null;
  return {
    ...state,
    requests,
    activeAnnouncement,
    activeEvent: publicGameEvent(state.activeEvent),
    current: requests.find((request) => request.id === state.currentId) || null,
    pending: requests.filter((request) => request.status === "pending"),
    queue: requests.filter((request) => request.status === "approved"),
    played: requests.filter((request) => request.status === "played").slice(-30).reverse(),
    rejected: requests.filter((request) => request.status === "rejected").slice(-30).reverse()
  };
}

function publicGameEvent(event) {
  if (!event) return null;
  const copy = {
    ...event,
    answerSet: Boolean(event.answer)
  };
  delete copy.answer;
  return copy;
}

function broadcast(state = loadState()) {
  const payload = `event: state\ndata: ${JSON.stringify(publicState(state))}\n\n`;
  for (const client of clients) client.write(payload);
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function clean(value, maxLength = 200) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanMessage(value) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 360);
}

function cleanLongMessage(value) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 520);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localTimeKey(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isAnnouncementActive(announcement, now = Date.now()) {
  if (!announcement) return false;
  if (!announcement.expiresAt) return true;
  return new Date(announcement.expiresAt).getTime() > now;
}

function normalizeAnnouncement(body, fallback = {}) {
  const type = ANNOUNCEMENT_TYPES.has(body.type) ? body.type : fallback.type || "notice";
  const durationSeconds = clampNumber(body.durationSeconds ?? fallback.durationSeconds, 10, 600, 75);
  const title = clean(body.title ?? fallback.title, 80) || (type === "kitchen" ? "주방 마감 안내" : "매장 공지");
  const message = cleanLongMessage(body.message ?? fallback.message) || "잠시 안내드립니다.";
  const createdAt = new Date();

  return {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    durationSeconds,
    voiceEnabled: Boolean(body.voiceEnabled ?? fallback.voiceEnabled ?? true),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + durationSeconds * 1000).toISOString()
  };
}

function setActiveAnnouncement(state, announcement) {
  state.activeAnnouncement = announcement;
  state.announcementHistory = [announcement, ...(state.announcementHistory || [])].slice(0, 50);
}

function normalizeKitchenCloseSettings(body, existing = defaultState().settings.kitchenClose) {
  const time = isValidTime(body.time) ? body.time : existing.time;
  return {
    ...existing,
    enabled: Boolean(body.enabled),
    time,
    title: clean(body.title, 80) || existing.title,
    message: cleanLongMessage(body.message) || existing.message,
    durationSeconds: clampNumber(body.durationSeconds, 10, 600, existing.durationSeconds),
    voiceEnabled: Boolean(body.voiceEnabled),
    lastTriggeredDate: clean(existing.lastTriggeredDate, 20)
  };
}

function normalizeGameEvent(body, existing = {}) {
  const type = GAME_EVENT_TYPES.has(body.type) ? body.type : existing.type || "boss";
  const title = clean(body.title ?? existing.title, 90) || "사장님과 게임 이벤트";
  const message = cleanLongMessage(body.message ?? existing.message) || "QR 페이지에서 닉네임과 테이블을 입력하고 참여하세요.";
  const prize = clean(body.prize ?? existing.prize, 120);
  const question = cleanLongMessage(body.question ?? existing.question);
  const answer = clean(body.answer ?? existing.answer, 120);

  return {
    id: existing.id || crypto.randomUUID(),
    type,
    title,
    message,
    prize,
    question,
    answer,
    joinOpen: Boolean(body.joinOpen ?? existing.joinOpen ?? true),
    participants: Array.isArray(existing.participants) ? existing.participants : [],
    winner: existing.winner || null,
    winners: Array.isArray(existing.winners) ? existing.winners : [],
    bossChoice: existing.bossChoice || "",
    winnerTable: existing.winnerTable || "",
    result: existing.result || "",
    status: existing.status || "open",
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function participantLabel(participant) {
  return [participant.tableName, participant.nickname].filter(Boolean).join(" / ");
}

function normalizeAnswer(value) {
  return clean(value, 120).toLowerCase().replace(/\s+/g, "");
}

function rpsBeats(playerChoice, bossChoice) {
  return (
    (playerChoice === "rock" && bossChoice === "scissors") ||
    (playerChoice === "scissors" && bossChoice === "paper") ||
    (playerChoice === "paper" && bossChoice === "rock")
  );
}

function gameWinner(participant) {
  return {
    ...participant,
    pickedAt: new Date().toISOString()
  };
}

function joinGameEvent(state, body) {
  const event = state.activeEvent;
  if (!event || event.status !== "open") throw new Error("진행 중인 이벤트가 없습니다.");
  if (!event.joinOpen) throw new Error("현재 이벤트 참여가 마감되었습니다.");

  const nickname = clean(body.nickname, 50);
  const tableName = clean(body.tableName, 50);
  const note = clean(body.note, 100);
  const choice = RPS_CHOICES.has(body.choice) ? body.choice : "";
  const answer = clean(body.answer, 120);
  if (!nickname && !tableName) throw new Error("닉네임이나 테이블 번호를 입력하세요.");
  if (event.type === "boss" && !choice) throw new Error("가위바위보 선택이 필요합니다.");
  if (event.type === "quiz" && !answer) throw new Error("퀴즈 정답을 입력하세요.");
  if (event.type === "table" && !tableName) throw new Error("테이블/팀 이름이 필요합니다.");

  const duplicate = event.participants.find((participant) => (
    participant.nickname === nickname &&
    participant.tableName === tableName
  ));
  if (duplicate) throw new Error("이미 참여한 이름입니다.");

  const participant = {
    id: crypto.randomUUID(),
    nickname,
    tableName,
    note,
    choice,
    answer,
    joinedAt: new Date().toISOString()
  };
  event.participants.push(participant);
  event.updatedAt = new Date().toISOString();
  return participant;
}

function drawGameEventWinner(state) {
  const event = state.activeEvent;
  if (!event || event.status !== "open") throw new Error("진행 중인 이벤트가 없습니다.");
  if (!event.participants.length) throw new Error("참여자가 없습니다.");

  const winner = event.participants[Math.floor(Math.random() * event.participants.length)];
  event.winner = gameWinner(winner);
  event.winners = [event.winner];
  event.result = "랜덤 추첨 완료";
  event.joinOpen = false;
  event.updatedAt = new Date().toISOString();
  return event.winner;
}

function resolveGameEvent(state, body) {
  const event = state.activeEvent;
  if (!event || event.status !== "open") throw new Error("진행 중인 이벤트가 없습니다.");
  if (!event.participants.length) throw new Error("참여자가 없습니다.");

  if (event.type === "boss") {
    const bossChoice = RPS_CHOICES.has(body.bossChoice) ? body.bossChoice : "";
    if (!bossChoice) throw new Error("사장님 선택을 고르세요.");
    const winners = event.participants.filter((participant) => rpsBeats(participant.choice, bossChoice));
    const draws = event.participants.filter((participant) => participant.choice === bossChoice).length;
    event.bossChoice = bossChoice;
    event.winners = winners.map(gameWinner);
    event.winner = event.winners[0] || null;
    event.result = winners.length
      ? `손님 승리 ${winners.length}명 · 사장님 ${RPS_LABELS[bossChoice]}`
      : draws
        ? `무승부 ${draws}명 · 사장님 ${RPS_LABELS[bossChoice]}`
        : `사장님 승리 · 사장님 ${RPS_LABELS[bossChoice]}`;
  } else if (event.type === "quiz") {
    const answer = normalizeAnswer(event.answer);
    if (!answer) throw new Error("이벤트 시작 시 퀴즈 정답을 설정하세요.");
    const winners = event.participants.filter((participant) => normalizeAnswer(participant.answer) === answer);
    event.winners = winners.map(gameWinner);
    event.winner = event.winners[0] || null;
    event.result = winners.length ? `정답자 ${winners.length}명` : "정답자가 없습니다.";
  } else if (event.type === "table") {
    const tables = [...new Set(event.participants.map((participant) => participant.tableName).filter(Boolean))];
    if (!tables.length) throw new Error("참여한 테이블이 없습니다.");
    const winnerTable = tables[Math.floor(Math.random() * tables.length)];
    const winners = event.participants.filter((participant) => participant.tableName === winnerTable);
    event.winnerTable = winnerTable;
    event.winners = winners.map(gameWinner);
    event.winner = event.winners[0] || null;
    event.result = `${winnerTable} 당첨`;
  } else {
    drawGameEventWinner(state);
    return state.activeEvent;
  }

  event.joinOpen = false;
  event.updatedAt = new Date().toISOString();
  return event;
}

function closeGameEvent(state) {
  if (!state.activeEvent) throw new Error("종료할 이벤트가 없습니다.");
  const closed = {
    ...state.activeEvent,
    status: "closed",
    closedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.eventHistory = [closed, ...(state.eventHistory || [])].slice(0, 50);
  state.activeEvent = null;
}

function extractYouTubeId(input) {
  const raw = clean(input, 500);
  if (!raw) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, "");
    let candidate = "";

    if (host === "youtu.be") {
      candidate = parsed.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") candidate = parsed.searchParams.get("v") || "";
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(pathParts[0])) candidate = pathParts[1] || "";
    }

    return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : "";
  } catch {
    return "";
  }
}

function normalizeTheme(body, existing = {}) {
  const legacyBirthday = body.occasion === "birthday" || existing.occasion === "birthday";
  const requestedTheme = clean(body.theme ?? existing.theme, 30);
  const theme = THEME_KEYS.has(requestedTheme) ? requestedTheme : legacyBirthday ? "birthday" : "normal";
  const themeName = clean(body.themeName ?? existing.themeName ?? body.birthdayName ?? existing.birthdayName, 80);
  return { theme, themeName };
}

function normalizeRequest(body, existing = {}) {
  const youtubeUrl = clean(body.youtubeUrl ?? existing.youtubeUrl, 500);
  const youtubeId = extractYouTubeId(body.youtubeId || youtubeUrl || existing.youtubeId);
  const { theme, themeName } = normalizeTheme(body, existing);
  return {
    title: clean(body.title ?? existing.title, 120),
    artist: clean(body.artist ?? existing.artist, 120),
    youtubeUrl,
    youtubeId,
    requester: clean(body.requester ?? existing.requester, 60),
    message: cleanMessage(body.message ?? existing.message),
    theme,
    themeName,
    occasion: theme === "birthday" ? "birthday" : "normal",
    birthdayName: theme === "birthday" ? themeName : ""
  };
}

function requireYouTubeId(request) {
  if (!request.youtubeId) {
    throw new Error("YouTube 링크나 11자리 영상 ID가 필요합니다.");
  }
}

function playRequest(state, requestId) {
  const target = state.requests.find((request) => request.id === requestId);
  if (!target) throw new Error("신청곡을 찾을 수 없습니다.");
  requireYouTubeId(target);

  for (const request of state.requests) {
    if (request.status === "playing") {
      request.status = "played";
      request.endedAt = new Date().toISOString();
    }
  }

  target.status = "playing";
  target.playedAt = target.playedAt || new Date().toISOString();
  state.currentId = target.id;
  state.currentStartedAt = new Date().toISOString();
}

function playNextApproved(state) {
  const next = state.requests.find((request) => request.status === "approved" && request.youtubeId);
  if (!next) {
    const current = state.requests.find((request) => request.id === state.currentId);
    if (current && current.status === "playing") {
      current.status = "played";
      current.endedAt = new Date().toISOString();
    }
    state.currentId = null;
    state.currentStartedAt = null;
    return null;
  }
  playRequest(state, next.id);
  return next;
}

function requestUrl(req, pathname = "/request") {
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${req.headers.host}${pathname}`;
}

function getLanUrls() {
  const urls = [];
  const networks = os.networkInterfaces();
  for (const entries of Object.values(networks)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${PORT}`);
      }
    }
  }
  return urls;
}

function textFromRuns(value) {
  if (!value) return "";
  if (value.simpleText) return clean(value.simpleText, 180);
  if (Array.isArray(value.runs)) {
    return clean(value.runs.map((run) => run.text || "").join(""), 180);
  }
  return "";
}

function bestThumbnail(thumbnails = []) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return "";
  const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
  return clean(sorted[0]?.url, 500);
}

function extractJsonAfterMarker(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;

  const start = html.indexOf("{", markerIndex);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let quote = "";
  let escaping = false;

  for (let index = start; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      inString = true;
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return html.slice(start, index + 1);
    }
  }

  return null;
}

function extractYouTubeInitialData(html) {
  const markers = [
    "var ytInitialData =",
    "window[\"ytInitialData\"] =",
    "ytInitialData ="
  ];

  for (const marker of markers) {
    const json = extractJsonAfterMarker(html, marker);
    if (!json) continue;
    try {
      return JSON.parse(json);
    } catch {
      continue;
    }
  }

  return null;
}

function collectVideoRenderers(node, results, seen) {
  if (!node || results.length >= 10) return;

  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, results, seen);
    return;
  }

  if (typeof node !== "object") return;

  if (node.videoRenderer?.videoId && !seen.has(node.videoRenderer.videoId)) {
    const video = node.videoRenderer;
    const videoId = clean(video.videoId, 20);
    const title = textFromRuns(video.title);
    if (videoId && title) {
      seen.add(videoId);
      const artist = textFromRuns(video.ownerText) || textFromRuns(video.longBylineText) || textFromRuns(video.shortBylineText);
      results.push({
        videoId,
        title,
        artist,
        duration: textFromRuns(video.lengthText),
        views: textFromRuns(video.viewCountText),
        published: textFromRuns(video.publishedTimeText),
        thumbnail: bestThumbnail(video.thumbnail?.thumbnails),
        url: `https://www.youtube.com/watch?v=${videoId}`
      });
    }
  }

  for (const value of Object.values(node)) collectVideoRenderers(value, results, seen);
}

async function searchYouTube(query) {
  const q = clean(query, 100);
  if (q.length < 2) return [];

  const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
    headers: {
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    },
    signal: AbortSignal.timeout(7000)
  });

  if (!response.ok) throw new Error("YouTube 검색 요청에 실패했습니다.");

  const html = await response.text();
  const initialData = extractYouTubeInitialData(html);
  if (!initialData) throw new Error("YouTube 검색 결과를 읽지 못했습니다.");

  const results = [];
  collectVideoRenderers(initialData, results, new Set());
  return results.slice(0, 8);
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, publicState());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write(`event: state\ndata: ${JSON.stringify(publicState())}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/qr.svg") {
    const svg = await QRCode.toString(requestUrl(req), {
      type: "svg",
      margin: 1,
      width: 512,
      color: {
        dark: "#101820",
        light: "#ffffff"
      }
    });
    res.writeHead(200, {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(svg);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/youtube/search") {
    try {
      const results = await searchYouTube(url.searchParams.get("q") || "");
      sendJson(res, 200, { results });
    } catch (error) {
      sendError(res, 502, error.message || "YouTube 검색에 실패했습니다.");
    }
    return true;
  }

  if (!url.pathname.startsWith("/api/")) return false;

  if (req.method !== "POST") {
    sendError(res, 405, "허용되지 않은 요청입니다.");
    return true;
  }

  let body = {};
  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return true;
  }

  const state = loadState();

  try {
    if (url.pathname === "/api/announcements") {
      const announcement = normalizeAnnouncement(body);
      setActiveAnnouncement(state, announcement);
      sendJson(res, 201, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/announcements/clear") {
      state.activeAnnouncement = null;
      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/settings/kitchen-close") {
      state.settings.kitchenClose = normalizeKitchenCloseSettings(body, state.settings.kitchenClose);
      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/settings/kitchen-close/test") {
      const settings = normalizeKitchenCloseSettings(body, state.settings.kitchenClose);
      state.settings.kitchenClose = settings;
      setActiveAnnouncement(state, normalizeAnnouncement({
        type: "kitchen",
        title: settings.title,
        message: settings.message,
        durationSeconds: settings.durationSeconds,
        voiceEnabled: settings.voiceEnabled
      }));
      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/game-events/start") {
      if (state.activeEvent?.status === "open") {
        closeGameEvent(state);
      }
      state.activeEvent = normalizeGameEvent(body);
      sendJson(res, 201, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/game-events/update") {
      if (!state.activeEvent) throw new Error("진행 중인 이벤트가 없습니다.");
      state.activeEvent = normalizeGameEvent(body, state.activeEvent);
      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/game-events/join") {
      joinGameEvent(state, body);
      sendJson(res, 201, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/game-events/draw") {
      drawGameEventWinner(state);
      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/game-events/resolve") {
      resolveGameEvent(state, body);
      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/game-events/reopen") {
      if (!state.activeEvent) throw new Error("진행 중인 이벤트가 없습니다.");
      state.activeEvent.joinOpen = true;
      state.activeEvent.winner = null;
      state.activeEvent.winners = [];
      state.activeEvent.result = "";
      state.activeEvent.bossChoice = "";
      state.activeEvent.winnerTable = "";
      state.activeEvent.updatedAt = new Date().toISOString();
      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/game-events/close") {
      closeGameEvent(state);
      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/requests") {
      const normalized = normalizeRequest(body);
      if (!normalized.title) throw new Error("곡 제목을 입력하세요.");
      if (!normalized.youtubeId) throw new Error("YouTube 링크나 영상 ID를 입력하세요.");

      const request = {
        id: crypto.randomUUID(),
        ...normalized,
        status: "pending",
        source: clean(body.source, 30) || "guest",
        createdAt: new Date().toISOString()
      };
      state.requests.push(request);
      sendJson(res, 201, publicState(saveAndBroadcast(state)));
      return true;
    }

    const requestMatch = url.pathname.match(/^\/api\/requests\/([^/]+)\/([^/]+)$/);
    if (requestMatch) {
      const [, id, action] = requestMatch;
      const request = state.requests.find((item) => item.id === id);
      if (!request) throw new Error("신청곡을 찾을 수 없습니다.");

      if (action === "update") {
        Object.assign(request, normalizeRequest(body, request));
        request.updatedAt = new Date().toISOString();
      } else if (action === "approve") {
        requireYouTubeId(request);
        request.status = "approved";
        request.approvedAt = new Date().toISOString();
      } else if (action === "reject") {
        request.status = "rejected";
        request.rejectedAt = new Date().toISOString();
        if (state.currentId === request.id) {
          state.currentId = null;
          state.currentStartedAt = null;
        }
      } else if (action === "play") {
        playRequest(state, request.id);
      } else if (action === "delete") {
        state.requests = state.requests.filter((item) => item.id !== request.id);
        if (state.currentId === request.id) {
          state.currentId = null;
          state.currentStartedAt = null;
        }
      } else {
        throw new Error("알 수 없는 작업입니다.");
      }

      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/current/next") {
      playNextApproved(state);
      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/current/clear") {
      const current = state.requests.find((request) => request.id === state.currentId);
      if (current && current.status === "playing") {
        current.status = "played";
        current.endedAt = new Date().toISOString();
      }
      state.currentId = null;
      state.currentStartedAt = null;
      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    if (url.pathname === "/api/player/ended") {
      const current = state.requests.find((request) => request.id === state.currentId);
      if (current && current.status === "playing") {
        current.status = "played";
        current.endedAt = new Date().toISOString();
      }
      playNextApproved(state);
      sendJson(res, 200, publicState(saveAndBroadcast(state)));
      return true;
    }

    sendError(res, 404, "API 경로를 찾을 수 없습니다.");
    return true;
  } catch (error) {
    sendError(res, 400, error.message);
    return true;
  }
}

function serveStatic(req, res, url) {
  const route = url.pathname === "/" ? "/request.html" : `${url.pathname.replace(/\/$/, "")}.html`;
  const candidates = [
    path.join(PUBLIC_DIR, url.pathname),
    path.join(PUBLIC_DIR, route)
  ];

  const filePath = candidates.find((candidate) => {
    const resolved = path.resolve(candidate);
    return resolved.startsWith(PUBLIC_DIR) && fs.existsSync(resolved) && fs.statSync(resolved).isFile();
  });

  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

function checkKitchenCloseSchedule() {
  const state = loadState();
  const settings = state.settings.kitchenClose;
  if (!settings.enabled || !isValidTime(settings.time)) return;

  const now = new Date();
  const today = localDateKey(now);
  if (localTimeKey(now) !== settings.time || settings.lastTriggeredDate === today) return;

  setActiveAnnouncement(state, normalizeAnnouncement({
    type: "kitchen",
    title: settings.title,
    message: settings.message,
    durationSeconds: settings.durationSeconds,
    voiceEnabled: settings.voiceEnabled
  }));
  state.settings.kitchenClose.lastTriggeredDate = today;
  saveAndBroadcast(state);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    const handled = await handleApi(req, res, url);
    if (!handled) serveStatic(req, res, url);
  } catch (error) {
    sendError(res, 500, error.message || "서버 오류가 발생했습니다.");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Song request server running on http://localhost:${PORT}`);
  for (const url of getLanUrls()) console.log(`LAN URL: ${url}`);
  console.log(`Request page: http://localhost:${PORT}/request`);
  console.log(`Admin page:   http://localhost:${PORT}/admin`);
  console.log(`Display page: http://localhost:${PORT}/display`);
  checkKitchenCloseSchedule();
  setInterval(checkKitchenCloseSchedule, 15 * 1000);
});
