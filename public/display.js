const body = document.body;
const unlock = document.querySelector("#unlock");
const startDisplay = document.querySelector("#startDisplay");
const nowLabel = document.querySelector("#nowLabel");
const themeBanner = document.querySelector("#themeBanner");
const displayTitle = document.querySelector("#displayTitle");
const displayArtist = document.querySelector("#displayArtist");
const displayStory = document.querySelector("#displayStory");
const nextList = document.querySelector("#nextList");
const confettiLayer = document.querySelector("#confettiLayer");
const announcementOverlay = document.querySelector("#announcementOverlay");
const announcementPanel = document.querySelector("#announcementPanel");
const announcementKicker = document.querySelector("#announcementKicker");
const announcementTitle = document.querySelector("#announcementTitle");
const announcementMessage = document.querySelector("#announcementMessage");
const announcementTimer = document.querySelector("#announcementTimer");
const gameEventDisplay = document.querySelector("#gameEventDisplay");
const gameEventKicker = document.querySelector("#gameEventKicker");
const gameEventCount = document.querySelector("#gameEventCount");
const gameEventTitle = document.querySelector("#gameEventTitle");
const gameEventMessage = document.querySelector("#gameEventMessage");
const gameEventPrize = document.querySelector("#gameEventPrize");
const gameEventResult = document.querySelector("#gameEventResult");
const gameEventWinner = document.querySelector("#gameEventWinner");

let player = null;
let playerReady = false;
let youtubeReady = false;
let unlocked = false;
let latestState = null;
let loadedVideoId = "";
let endedVideoId = "";
let activeAnnouncementId = "";
let spokenAnnouncementId = "";
let announcementTimerId = null;
let announcementHideTimerId = null;

const THEME_CONFIG = {
  normal: {
    label: "지금 재생 중",
    modeClass: "",
    banner: () => "",
    confetti: false
  },
  birthday: {
    label: "생일 축하",
    modeClass: "birthday-mode",
    banner: (name, requester) => `${name || requester || "오늘의 주인공"} 생일 축하합니다`,
    confetti: true
  },
  club: {
    label: "동아리 환영",
    modeClass: "club-mode",
    banner: (name) => `${name || "오늘의 동아리"} 환영합니다`,
    confetti: true
  },
  department: {
    label: "학과 환영",
    modeClass: "department-mode",
    banner: (name) => `${name || "오늘의 과모임"} 환영합니다`,
    confetti: false
  },
  freshman: {
    label: "새내기 환영",
    modeClass: "freshman-mode",
    banner: (name) => `${name || "새내기 여러분"} 환영합니다`,
    confetti: true
  },
  exam: {
    label: "시험 끝",
    modeClass: "exam-mode",
    banner: (name) => `${name || "시험 끝난 여러분"} 수고했어요`,
    confetti: true
  },
  couple: {
    label: "기념일",
    modeClass: "couple-mode",
    banner: (name) => `${name || "오늘의 주인공"} 축하합니다`,
    confetti: true
  },
  farewell: {
    label: "송별/졸업",
    modeClass: "farewell-mode",
    banner: (name) => `${name || "오늘의 주인공"} 응원합니다`,
    confetti: false
  },
  custom: {
    label: "스페셜 신청곡",
    modeClass: "custom-mode",
    banner: (name) => `${name || "오늘의 게스트"} 환영합니다`,
    confetti: true
  }
};

const THEME_CLASSES = Object.values(THEME_CONFIG)
  .map((theme) => theme.modeClass)
  .filter(Boolean);

const ANNOUNCEMENT_LABELS = {
  notice: "매장 공지",
  kitchen: "주방 마감 안내",
  warning: "긴급 안내"
};

const GAME_EVENT_LABELS = {
  boss: "사장님과 게임",
  draw: "랜덤 추첨",
  quiz: "즉석 퀴즈",
  table: "테이블 대항",
  custom: "스페셜 이벤트"
};

window.onYouTubeIframeAPIReady = () => {
  youtubeReady = true;
  maybeCreatePlayer();
};

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function displayName(request) {
  const artist = request.artist ? ` - ${request.artist}` : "";
  return `${request.title}${artist}`;
}

function requestTheme(request) {
  if (request.theme && THEME_CONFIG[request.theme]) return request.theme;
  return request.occasion === "birthday" ? "birthday" : "normal";
}

function setThemeClass(modeClass = "") {
  body.classList.remove(...THEME_CLASSES);
  if (modeClass) body.classList.add(modeClass);
}

function maybeCreatePlayer() {
  if (!youtubeReady || !unlocked || player) return;
  player = new YT.Player("player", {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1
    },
    events: {
      onReady: () => {
        playerReady = true;
        syncPlayer(latestState);
      },
      onStateChange: handlePlayerState
    }
  });
}

function handlePlayerState(event) {
  if (event.data !== YT.PlayerState.ENDED || !latestState?.current?.youtubeId) return;
  const videoId = latestState.current.youtubeId;
  if (endedVideoId === videoId) return;
  endedVideoId = videoId;

  fetch("/api/player/ended", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId })
  }).catch(() => {});
}

function syncPlayer(state) {
  if (!player || !playerReady || typeof player.loadVideoById !== "function" || !state?.current?.youtubeId) return;
  const videoId = state.current.youtubeId;
  if (loadedVideoId === videoId) return;

  loadedVideoId = videoId;
  endedVideoId = "";
  player.loadVideoById(videoId);
  player.unMute();
  player.playVideo();
}

function setConfetti(enabled) {
  if (!enabled) {
    confettiLayer.innerHTML = "";
    return;
  }
  if (confettiLayer.childElementCount) return;

  const colors = ["#ffe8a3", "#ffffff", "#65e4d7", "#f472b6", "#38bdf8"];
  const fragments = Array.from({ length: 64 }, (_, index) => {
    const left = Math.random() * 100;
    const duration = 4 + Math.random() * 4;
    const delay = Math.random() * -6;
    const color = colors[index % colors.length];
    return `<i class="confetti" style="left:${left}%;background:${color};animation-duration:${duration}s;animation-delay:${delay}s"></i>`;
  });
  confettiLayer.innerHTML = fragments.join("");
}

function isAnnouncementActive(announcement) {
  if (!announcement) return false;
  if (!announcement.expiresAt) return true;
  return new Date(announcement.expiresAt).getTime() > Date.now();
}

function stopAnnouncementTimers() {
  if (announcementTimerId) clearInterval(announcementTimerId);
  if (announcementHideTimerId) clearTimeout(announcementHideTimerId);
  announcementTimerId = null;
  announcementHideTimerId = null;
}

function updateAnnouncementTimer(announcement) {
  if (!announcement.expiresAt) {
    announcementTimer.textContent = "";
    return;
  }
  const remainingSeconds = Math.max(0, Math.ceil((new Date(announcement.expiresAt).getTime() - Date.now()) / 1000));
  announcementTimer.textContent = `${remainingSeconds}초 후 자동으로 내려갑니다`;
}

function hideAnnouncement() {
  activeAnnouncementId = "";
  stopAnnouncementTimers();
  announcementOverlay.hidden = true;
  announcementOverlay.className = "announcement-overlay";
}

function speakAnnouncement(announcement) {
  if (!announcement.voiceEnabled || !unlocked || spokenAnnouncementId === announcement.id) return;
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`${announcement.title}. ${announcement.message}`);
  utterance.lang = "ko-KR";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
  spokenAnnouncementId = announcement.id;
}

function renderAnnouncement(state) {
  const announcement = state.activeAnnouncement;
  if (!isAnnouncementActive(announcement)) {
    hideAnnouncement();
    return;
  }

  const isNew = activeAnnouncementId !== announcement.id;
  activeAnnouncementId = announcement.id;
  announcementOverlay.hidden = false;
  announcementOverlay.className = `announcement-overlay ${announcement.type || "notice"}-announcement`;
  announcementPanel.className = `announcement-panel ${announcement.type || "notice"}-announcement`;
  announcementKicker.textContent = ANNOUNCEMENT_LABELS[announcement.type] || ANNOUNCEMENT_LABELS.notice;
  announcementTitle.textContent = announcement.title;
  announcementMessage.textContent = announcement.message;
  updateAnnouncementTimer(announcement);

  if (isNew) {
    stopAnnouncementTimers();
    announcementTimerId = setInterval(() => updateAnnouncementTimer(announcement), 1000);
    if (announcement.expiresAt) {
      const delay = Math.max(0, new Date(announcement.expiresAt).getTime() - Date.now());
      announcementHideTimerId = setTimeout(hideAnnouncement, delay);
    }
  }

  speakAnnouncement(announcement);
}

function participantName(participant) {
  return [participant.tableName, participant.nickname].filter(Boolean).join(" / ") || "참여자";
}

function renderGameEvent(state) {
  const event = state.activeEvent;
  if (!event) {
    gameEventDisplay.hidden = true;
    return;
  }

  const count = event.participants?.length || 0;
  gameEventDisplay.hidden = false;
  gameEventDisplay.className = `game-event-display event-display-${event.type || "boss"}`;
  gameEventKicker.textContent = GAME_EVENT_LABELS[event.type] || GAME_EVENT_LABELS.boss;
  gameEventCount.textContent = `참여 ${count}명`;
  gameEventTitle.textContent = event.title;
  gameEventMessage.textContent = event.question
    ? `${event.message}\n문제: ${event.question}`
    : event.message;
  gameEventPrize.textContent = event.prize ? `상품: ${event.prize}` : "";
  gameEventResult.hidden = !event.result;
  gameEventResult.textContent = event.result || "";

  if (event.winners?.length) {
    gameEventWinner.hidden = false;
    gameEventWinner.textContent = `승리: ${event.winners.slice(0, 4).map(participantName).join(", ")}`;
  } else if (event.winner) {
    gameEventWinner.hidden = false;
    gameEventWinner.textContent = `당첨: ${participantName(event.winner)}`;
  } else {
    gameEventWinner.hidden = true;
    gameEventWinner.textContent = "";
  }
}

function renderIdle(state) {
  body.classList.add("idle");
  setThemeClass();
  nowLabel.textContent = "신청곡 대기 중";
  themeBanner.textContent = "";
  themeBanner.classList.remove("show");
  displayTitle.textContent = "신청곡을 기다리는 중";
  displayArtist.textContent = "QR로 노래와 사연을 남겨주세요";
  displayStory.classList.remove("show");
  displayStory.textContent = "";
  setConfetti(false);
  renderNextList(state);
}

function renderCurrent(state) {
  const current = state.current;
  const themeKey = requestTheme(current);
  const config = THEME_CONFIG[themeKey] || THEME_CONFIG.normal;
  const themeName = current.themeName || current.birthdayName || "";
  const banner = config.banner(themeName, current.requester);
  body.classList.remove("idle");
  setThemeClass(config.modeClass);

  nowLabel.textContent = config.label;
  themeBanner.textContent = banner;
  themeBanner.classList.toggle("show", Boolean(banner));
  displayTitle.textContent = current.title || "제목 미입력";
  displayArtist.textContent = current.artist || "아티스트 정보 없음";

  if (current.message) {
    displayStory.classList.add("show");
    displayStory.textContent = current.message;
  } else {
    displayStory.classList.remove("show");
    displayStory.textContent = "";
  }

  setConfetti(config.confetti);
  renderNextList(state);
  syncPlayer(state);
}

function renderNextList(state) {
  const queue = state.queue || [];
  if (!queue.length) {
    nextList.innerHTML = `<div class="next-item">다음 신청곡 대기 중</div>`;
    return;
  }

  nextList.innerHTML = [
    `<strong>Next</strong>`,
    ...queue.slice(0, 3).map((request) => `<div class="next-item">${escapeHtml(displayName(request))}</div>`)
  ].join("");
}

function render(state) {
  latestState = state;
  renderAnnouncement(state);
  renderGameEvent(state);
  if (!state.current) {
    renderIdle(state);
    return;
  }
  renderCurrent(state);
}

startDisplay.addEventListener("click", () => {
  unlocked = true;
  unlock.classList.add("hidden");
  maybeCreatePlayer();
  syncPlayer(latestState);
  if (latestState?.activeAnnouncement) speakAnnouncement(latestState.activeAnnouncement);

  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
});

const events = new EventSource("/api/events");
events.addEventListener("state", (event) => render(JSON.parse(event.data)));
events.onerror = () => {
  nowLabel.textContent = "Reconnecting";
};
