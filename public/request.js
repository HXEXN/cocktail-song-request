const form = document.querySelector("#requestForm");
const notice = document.querySelector("#notice");
const message = document.querySelector("#message");
const messageCount = document.querySelector("#messageCount");
const queuePreview = document.querySelector("#queuePreview");
const songSearch = document.querySelector("#songSearch");
const songSearchButton = document.querySelector("#songSearchButton");
const searchResults = document.querySelector("#searchResults");
const theme = document.querySelector("#theme");
const themePicker = document.querySelector("#themePicker");
const themeNameField = document.querySelector("#themeNameField");
const themeNameLabel = document.querySelector("#themeNameLabel");
const themeSelected = document.querySelector("#themeSelected");
const themePreview = document.querySelector("#themePreview");
const themePreviewLabel = document.querySelector("#themePreviewLabel");
const themePreviewTitle = document.querySelector("#themePreviewTitle");
const themePreviewCopy = document.querySelector("#themePreviewCopy");
const eventJoinCard = document.querySelector("#eventJoinCard");
const eventJoinTitle = document.querySelector("#eventJoinTitle");
const eventJoinMessage = document.querySelector("#eventJoinMessage");
const eventJoinForm = document.querySelector("#eventJoinForm");
const eventJoinNotice = document.querySelector("#eventJoinNotice");
const eventJoinMeta = document.querySelector("#eventJoinMeta");
const eventChoiceField = document.querySelector("#eventChoiceField");
const eventAnswerField = document.querySelector("#eventAnswerField");

let searchTimer = null;
let searchController = null;
let latestResults = [];
let activeEventId = "";

const THEME_FIELDS = {
  normal: {
    label: "주인공 이름",
    placeholder: "",
    display: "일반 신청곡",
    previewLabel: "지금 재생 중",
    previewTitle: () => "곡 제목과 사연 중심",
    previewCopy: "밝은 화면에서도 읽히는 기본 레이아웃"
  },
  birthday: {
    label: "생일자 이름",
    placeholder: "예: 민지",
    display: "생일 축하",
    previewLabel: "생일 축하",
    previewTitle: (name) => `${name || "오늘의 주인공"} 생일 축하합니다`,
    previewCopy: "축하 문구와 컨페티가 함께 표시됩니다."
  },
  club: {
    label: "동아리/모임명",
    placeholder: "예: 사진동아리",
    display: "동아리/모임 환영",
    previewLabel: "동아리 환영",
    previewTitle: (name) => `${name || "오늘의 동아리"} 환영합니다`,
    previewCopy: "단체명과 사연이 화면에서 또렷하게 보입니다."
  },
  department: {
    label: "학과/과모임명",
    placeholder: "예: 경영학과 24학번",
    display: "학과/과모임 환영",
    previewLabel: "학과 환영",
    previewTitle: (name) => `${name || "오늘의 과모임"} 환영합니다`,
    previewCopy: "학과 행사나 뒤풀이에 맞춘 차분한 톤입니다."
  },
  freshman: {
    label: "환영 대상",
    placeholder: "예: 신입생 여러분",
    display: "새내기 환영",
    previewLabel: "새내기 환영",
    previewTitle: (name) => `${name || "새내기 여러분"} 환영합니다`,
    previewCopy: "밝고 활기찬 색감으로 첫 방문 분위기를 만듭니다."
  },
  exam: {
    label: "축하 대상",
    placeholder: "예: 기말 끝난 사람들",
    display: "시험 끝 축하",
    previewLabel: "시험 끝",
    previewTitle: (name) => `${name || "시험 끝난 여러분"} 수고했어요`,
    previewCopy: "수고했다는 문구가 크게 표시됩니다."
  },
  couple: {
    label: "기념일 주인공",
    placeholder: "예: 지민 & 현우",
    display: "커플/기념일",
    previewLabel: "기념일",
    previewTitle: (name) => `${name || "오늘의 주인공"} 축하합니다`,
    previewCopy: "기념일 문구와 사연을 중심으로 보여줍니다."
  },
  farewell: {
    label: "송별/졸업 주인공",
    placeholder: "예: 졸업반 선배님들",
    display: "송별/졸업",
    previewLabel: "송별/졸업",
    previewTitle: (name) => `${name || "오늘의 주인공"} 응원합니다`,
    previewCopy: "차분한 배경에 응원 문구가 강조됩니다."
  },
  custom: {
    label: "화면에 띄울 대상",
    placeholder: "예: 오늘의 게스트",
    display: "직접 입력 테마",
    previewLabel: "스페셜",
    previewTitle: (name) => `${name || "오늘의 게스트"} 환영합니다`,
    previewCopy: "오늘 상황에 맞춘 자유 문구로 표시됩니다."
  }
};

const GAME_EVENT_LABELS = {
  boss: "사장님 가위바위보",
  draw: "랜덤 추첨",
  quiz: "즉석 퀴즈",
  table: "테이블 대항",
  custom: "이벤트"
};

const RPS_LABELS = {
  rock: "바위",
  paper: "보",
  scissors: "가위"
};

function setNotice(type, text) {
  notice.className = `notice show ${type}`;
  notice.textContent = text;
}

function setEventNotice(type, text) {
  eventJoinNotice.className = `notice show ${type}`;
  eventJoinNotice.textContent = text;
}

function formValue(name) {
  return new FormData(form).get(name)?.toString().trim() || "";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청 처리에 실패했습니다.");
  return data;
}

async function getJson(url, signal) {
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청 처리에 실패했습니다.");
  return data;
}

function setSearchStatus(text) {
  searchResults.hidden = false;
  searchResults.innerHTML = `<div class="empty">${escapeHtml(text)}</div>`;
}

function renderSearchResults(results) {
  latestResults = results;
  searchResults.hidden = false;

  if (!results.length) {
    setSearchStatus("검색 결과가 없습니다.");
    return;
  }

  searchResults.innerHTML = results.map((result, index) => {
    const meta = [result.artist, result.duration, result.views].filter(Boolean).join(" · ");
    const thumbnail = result.thumbnail
      ? `<img class="search-thumb" src="${escapeHtml(result.thumbnail)}" alt="" loading="lazy" />`
      : `<span class="search-thumb"></span>`;

    return `
      <button class="search-result" type="button" data-result-index="${index}">
        ${thumbnail}
        <span>
          <span class="search-result-title">${escapeHtml(result.title)}</span>
          <span class="search-result-meta">${escapeHtml(meta || "YouTube")}</span>
        </span>
      </button>
    `;
  }).join("");
}

async function searchSongs() {
  const query = songSearch.value.trim();
  if (query.length < 2) {
    setSearchStatus("두 글자 이상 입력하세요.");
    return;
  }

  if (searchController) searchController.abort();
  searchController = new AbortController();
  songSearchButton.disabled = true;
  setSearchStatus("검색 중입니다.");

  try {
    const data = await getJson(`/api/youtube/search?q=${encodeURIComponent(query)}`, searchController.signal);
    renderSearchResults(data.results || []);
  } catch (error) {
    if (error.name !== "AbortError") setSearchStatus(error.message);
  } finally {
    songSearchButton.disabled = false;
  }
}

function renderQueuePreview(state) {
  const waiting = [...state.pending, ...state.queue];
  if (!waiting.length) {
    queuePreview.textContent = "아직 대기 중인 신청곡이 없습니다.";
    return;
  }
  const labels = waiting.slice(0, 5).map((request, index) => {
    const artist = request.artist ? ` - ${request.artist}` : "";
    return `${index + 1}. ${request.title}${artist}`;
  });
  queuePreview.innerHTML = labels.map((label) => `<div>${escapeHtml(label)}</div>`).join("");
}

function renderActiveEvent(state) {
  const activeEvent = state.activeEvent;
  if (!activeEvent) {
    activeEventId = "";
    eventJoinCard.className = "event-join-card";
    eventJoinTitle.textContent = "진행 중인 이벤트 없음";
    eventJoinMessage.textContent = "이벤트가 열리면 여기에서 참여할 수 있습니다.";
    eventJoinForm.hidden = true;
    eventChoiceField.hidden = true;
    eventAnswerField.hidden = true;
    eventJoinForm.elements.choice.required = false;
    eventJoinForm.elements.answer.required = false;
    eventJoinMeta.textContent = "";
    return;
  }

  if (activeEventId !== activeEvent.id) {
    activeEventId = activeEvent.id;
    eventJoinForm.reset();
    eventJoinNotice.className = "notice";
    eventJoinNotice.textContent = "";
  }

  eventJoinCard.className = `event-join-card event-type-${activeEvent.type || "boss"}`;
  eventJoinTitle.textContent = activeEvent.title;
  eventJoinMessage.textContent = activeEvent.question
    ? `${activeEvent.message}\n문제: ${activeEvent.question}`
    : activeEvent.message;
  eventJoinForm.hidden = !activeEvent.joinOpen;
  eventChoiceField.hidden = activeEvent.type !== "boss";
  eventAnswerField.hidden = activeEvent.type !== "quiz";
  eventJoinForm.elements.choice.required = activeEvent.type === "boss";
  eventJoinForm.elements.answer.required = activeEvent.type === "quiz";
  const count = activeEvent.participants?.length || 0;
  const prize = activeEvent.prize ? ` · 상품: ${activeEvent.prize}` : "";
  const winners = activeEvent.winners?.length
    ? ` · 승리: ${activeEvent.winners.slice(0, 3).map((winner) => [winner.tableName, winner.nickname].filter(Boolean).join(" / ")).join(", ")}`
    : activeEvent.winner
      ? ` · 당첨: ${[activeEvent.winner.tableName, activeEvent.winner.nickname].filter(Boolean).join(" / ")}`
      : "";
  const result = activeEvent.result ? ` · ${activeEvent.result}` : "";
  const label = GAME_EVENT_LABELS[activeEvent.type] ? `${GAME_EVENT_LABELS[activeEvent.type]} · ` : "";
  const bossChoice = activeEvent.bossChoice ? ` · 사장님 ${RPS_LABELS[activeEvent.bossChoice]}` : "";
  const winnerTable = activeEvent.winnerTable ? ` · 당첨 테이블: ${activeEvent.winnerTable}` : "";
  eventJoinMeta.textContent = `${label}참여 ${count}명${prize}${result}${bossChoice}${winnerTable}${winners}`;
}

function updateThemeField() {
  const config = THEME_FIELDS[theme.value] || THEME_FIELDS.normal;
  const input = form.elements.themeName;
  themeNameField.hidden = theme.value === "normal";
  themeNameLabel.textContent = config.label;
  input.placeholder = config.placeholder;
  if (theme.value === "normal") input.value = "";
  themeSelected.textContent = config.display;
  themePreview.className = `theme-preview theme-preview-${theme.value}`;
  themePreviewLabel.textContent = config.previewLabel;
  themePreviewTitle.textContent = config.previewTitle(input.value.trim());
  themePreviewCopy.textContent = config.previewCopy;
  themePicker.querySelectorAll("[data-theme]").forEach((button) => {
    const active = button.dataset.theme === theme.value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function selectTheme(nextTheme) {
  if (!THEME_FIELDS[nextTheme]) return;
  theme.value = nextTheme;
  updateThemeField();
}

themePicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme]");
  if (!button) return;
  selectTheme(button.dataset.theme);
});

themePicker.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...themePicker.querySelectorAll("[data-theme]")];
  const currentIndex = buttons.findIndex((button) => button.dataset.theme === theme.value);
  const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
  const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
  buttons[nextIndex].focus();
  selectTheme(buttons[nextIndex].dataset.theme);
});

form.elements.themeName.addEventListener("input", updateThemeField);

message.addEventListener("input", () => {
  messageCount.textContent = message.value.length;
});

songSearchButton.addEventListener("click", () => {
  searchSongs();
});

songSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchSongs();
  }
});

songSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const query = songSearch.value.trim();
  if (query.length < 2) {
    searchResults.hidden = true;
    latestResults = [];
    return;
  }
  searchTimer = setTimeout(searchSongs, 550);
});

searchResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-result-index]");
  if (!button) return;

  const result = latestResults[Number(button.dataset.resultIndex)];
  if (!result) return;

  form.elements.title.value = result.title || "";
  form.elements.artist.value = result.artist || "";
  form.elements.youtubeUrl.value = result.url || `https://youtu.be/${result.videoId}`;
  songSearch.value = result.title || songSearch.value;
  searchResults.hidden = true;
  setNotice("ok", "선택한 곡이 입력되었습니다. 신청자와 사연을 추가한 뒤 신청하세요.");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    await postJson("/api/requests", {
      title: formValue("title"),
      artist: formValue("artist"),
      youtubeUrl: formValue("youtubeUrl"),
      requester: formValue("requester"),
      message: formValue("message"),
      theme: formValue("theme"),
      themeName: formValue("themeName"),
      source: "guest"
    });

    form.reset();
    updateThemeField();
    messageCount.textContent = "0";
    setNotice("ok", "신청이 접수되었습니다. 직원 승인 후 화면에 표시됩니다.");
  } catch (error) {
    setNotice("err", error.message);
  } finally {
    submitButton.disabled = false;
  }
});

eventJoinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = eventJoinForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  const formData = new FormData(eventJoinForm);

  try {
    await postJson("/api/game-events/join", {
      nickname: formData.get("nickname"),
      tableName: formData.get("tableName"),
      note: formData.get("note"),
      choice: formData.get("choice"),
      answer: formData.get("answer")
    });
    eventJoinForm.reset();
    setEventNotice("ok", "이벤트 참여가 완료되었습니다.");
  } catch (error) {
    setEventNotice("err", error.message);
  } finally {
    submitButton.disabled = false;
  }
});

const events = new EventSource("/api/events");
events.addEventListener("state", (event) => {
  const state = JSON.parse(event.data);
  renderQueuePreview(state);
  renderActiveEvent(state);
});
events.onerror = () => {
  queuePreview.textContent = "대기열 연결이 끊겼습니다. 잠시 후 자동으로 다시 연결됩니다.";
};

updateThemeField();
