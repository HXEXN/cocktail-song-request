const stateView = {
  current: null,
  activeTab: "pending"
};

const songList = document.querySelector("#songList");
const currentTitle = document.querySelector("#currentTitle");
const currentMeta = document.querySelector("#currentMeta");
const pendingCount = document.querySelector("#pendingCount");
const queueCount = document.querySelector("#queueCount");
const nextButton = document.querySelector("#nextButton");
const clearButton = document.querySelector("#clearButton");
const requestUrl = document.querySelector("#requestUrl");
const manualForm = document.querySelector("#manualForm");
const manualNotice = document.querySelector("#manualNotice");
const manualTheme = document.querySelector("#manualTheme");
const manualThemeNameField = document.querySelector("#manualThemeNameField");
const manualThemeNameLabel = document.querySelector("#manualThemeNameLabel");
const announcementForm = document.querySelector("#announcementForm");
const announcementNotice = document.querySelector("#announcementNotice");
const clearAnnouncementButton = document.querySelector("#clearAnnouncementButton");
const kitchenCloseForm = document.querySelector("#kitchenCloseForm");
const kitchenCloseNotice = document.querySelector("#kitchenCloseNotice");
const testKitchenCloseButton = document.querySelector("#testKitchenCloseButton");
const gameEventForm = document.querySelector("#gameEventForm");
const gameEventNotice = document.querySelector("#gameEventNotice");
const activeGameEventCard = document.querySelector("#activeGameEventCard");
const drawGameWinnerButton = document.querySelector("#drawGameWinnerButton");
const gameEventType = document.querySelector("#gameEventType");
const gameEventQuestionField = document.querySelector("#gameEventQuestionField");
const gameEventAnswerField = document.querySelector("#gameEventAnswerField");
const gameResolveControls = document.querySelector("#gameResolveControls");
const bossChoice = document.querySelector("#bossChoice");
const resolveGameEventButton = document.querySelector("#resolveGameEventButton");
const reopenGameEventButton = document.querySelector("#reopenGameEventButton");
const closeGameEventButton = document.querySelector("#closeGameEventButton");

requestUrl.textContent = `${location.origin}/request`;

let settingsHydrated = false;

const THEME_LABELS = {
  normal: "일반",
  birthday: "생일",
  club: "동아리 환영",
  department: "학과 환영",
  freshman: "새내기 환영",
  exam: "시험 끝",
  couple: "기념일",
  farewell: "송별/졸업",
  custom: "스페셜"
};

const THEME_FIELDS = {
  normal: { label: "주인공 이름", placeholder: "" },
  birthday: { label: "생일자 이름", placeholder: "예: 민지" },
  club: { label: "동아리/모임명", placeholder: "예: 사진동아리" },
  department: { label: "학과/과모임명", placeholder: "예: 경영학과 24학번" },
  freshman: { label: "환영 대상", placeholder: "예: 신입생 여러분" },
  exam: { label: "축하 대상", placeholder: "예: 기말 끝난 사람들" },
  couple: { label: "기념일 주인공", placeholder: "예: 지민 & 현우" },
  farewell: { label: "송별/졸업 주인공", placeholder: "예: 졸업반 선배님들" },
  custom: { label: "화면에 띄울 대상", placeholder: "예: 오늘의 게스트" }
};

const GAME_EVENT_LABELS = {
  boss: "사장님과 게임",
  draw: "랜덤 추첨",
  quiz: "즉석 퀴즈",
  table: "테이블 대항",
  custom: "직접 입력"
};

const RPS_LABELS = {
  rock: "바위",
  paper: "보",
  scissors: "가위"
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

async function postJson(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청 처리에 실패했습니다.");
  return data;
}

function formPayload(form) {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

function checkboxValue(form, name) {
  return Boolean(form.querySelector(`[name="${name}"]`)?.checked);
}

function setNotice(target, type, text) {
  target.className = `notice show ${type}`;
  target.textContent = text;
}

function displayName(request) {
  const artist = request.artist ? ` - ${request.artist}` : "";
  return `${request.title}${artist}`;
}

function requestTheme(request) {
  if (request.theme) return request.theme;
  return request.occasion === "birthday" ? "birthday" : "normal";
}

function statusLabel(status) {
  return {
    pending: "승인 대기",
    approved: "대기열",
    playing: "재생 중",
    played: "재생 완료",
    rejected: "거절"
  }[status] || status;
}

function renderCurrent(state) {
  if (!state.current) {
    currentTitle.textContent = "대기 중";
    currentMeta.textContent = state.activeAnnouncement
      ? `공지 표시 중: ${state.activeAnnouncement.title}`
      : "재생 중인 신청곡이 없습니다.";
    return;
  }
  currentTitle.textContent = displayName(state.current);
  const themeLabel = THEME_LABELS[requestTheme(state.current)] || THEME_LABELS.normal;
  const requester = state.current.requester ? `신청자: ${state.current.requester}` : "신청자 정보 없음";
  currentMeta.textContent = `${requester} · ${themeLabel}`;
}

function renderSettings(state) {
  const settings = state.settings?.kitchenClose;
  if (!settings || settingsHydrated) return;

  kitchenCloseForm.elements.enabled.checked = Boolean(settings.enabled);
  kitchenCloseForm.elements.time.value = settings.time || "00:00";
  kitchenCloseForm.elements.title.value = settings.title || "주방 마감 안내";
  kitchenCloseForm.elements.message.value = settings.message || "";
  kitchenCloseForm.elements.durationSeconds.value = settings.durationSeconds || 90;
  kitchenCloseForm.elements.voiceEnabled.checked = Boolean(settings.voiceEnabled);
  settingsHydrated = true;
}

function participantName(participant) {
  return [participant.tableName, participant.nickname].filter(Boolean).join(" / ") || "이름 없음";
}

function participantGameDetail(participant, event) {
  if (event.type === "boss" && participant.choice) return ` · ${RPS_LABELS[participant.choice] || participant.choice}`;
  if (event.type === "quiz" && participant.answer) return ` · 답: ${participant.answer}`;
  if (participant.note) return ` · ${participant.note}`;
  return "";
}

function winnerList(event) {
  const winners = event.winners || [];
  if (winners.length) {
    return `<div class="event-winner">승리: ${winners.map((winner) => escapeHtml(participantName(winner))).join(", ")}</div>`;
  }
  if (event.winner) {
    return `<div class="event-winner">당첨: ${escapeHtml(participantName(event.winner))}</div>`;
  }
  return "";
}

function updateGameEventFields() {
  const isQuiz = gameEventType.value === "quiz";
  gameEventQuestionField.hidden = !isQuiz;
  gameEventAnswerField.hidden = !isQuiz;
  gameEventForm.elements.question.required = isQuiz;
  gameEventForm.elements.answer.required = isQuiz;
}

function renderGameEvent(state) {
  const event = state.activeEvent;
  const buttons = [drawGameWinnerButton, reopenGameEventButton, closeGameEventButton, resolveGameEventButton];

  if (!event) {
    activeGameEventCard.innerHTML = "진행 중인 이벤트가 없습니다.";
    gameResolveControls.hidden = true;
    buttons.forEach((button) => {
      button.disabled = true;
    });
    return;
  }

  buttons.forEach((button) => {
    button.disabled = false;
  });
  gameResolveControls.hidden = !["boss", "quiz", "table"].includes(event.type);
  bossChoice.hidden = event.type !== "boss";
  gameResolveControls.querySelector("label").hidden = event.type !== "boss";
  resolveGameEventButton.textContent = event.type === "boss"
    ? "가위바위보 결과 발표"
    : event.type === "quiz"
      ? "퀴즈 정답자 발표"
      : "테이블 승자 발표";
  drawGameWinnerButton.hidden = ["boss", "quiz", "table"].includes(event.type);

  const participants = event.participants || [];
  const winners = winnerList(event);
  const participantList = participants.length
    ? participants.slice(-8).reverse().map((participant) => (
      `<li>${escapeHtml(participantName(participant))}${escapeHtml(participantGameDetail(participant, event))}</li>`
    )).join("")
    : "<li>아직 참여자가 없습니다.</li>";
  const prize = event.prize ? `<div class="song-meta">상품: ${escapeHtml(event.prize)}</div>` : "";
  const question = event.question ? `<div class="song-meta">문제: ${escapeHtml(event.question)}</div>` : "";
  const result = event.result ? `<div class="event-result">${escapeHtml(event.result)}</div>` : "";

  activeGameEventCard.innerHTML = `
    <div class="stack">
      <span class="status-pill">${escapeHtml(GAME_EVENT_LABELS[event.type] || "이벤트")}</span>
      <strong>${escapeHtml(event.title)}</strong>
      <p class="subcopy">${escapeHtml(event.message)}</p>
      ${prize}
      ${question}
      <div class="song-meta">참여 ${participants.length}명 · ${event.joinOpen ? "참여 가능" : "참여 마감"}</div>
      ${result}
      ${winners}
      <ul class="event-participant-list">${participantList}</ul>
    </div>
  `;
}

function renderSongCard(request) {
  const theme = requestTheme(request);
  const themeName = request.themeName || request.birthdayName || "";
  const themePill = theme !== "normal"
    ? `<span class="status-pill">${escapeHtml(THEME_LABELS[theme] || "스페셜")}: ${escapeHtml(themeName || "대상 미입력")}</span>`
    : "";
  const requester = request.requester ? `신청자: ${escapeHtml(request.requester)}` : "신청자 정보 없음";
  const youtubeLink = request.youtubeId
    ? `<a href="https://youtu.be/${escapeHtml(request.youtubeId)}" target="_blank" rel="noreferrer">YouTube 확인</a>`
    : "YouTube 링크 없음";
  const message = request.message ? `<div class="message">${escapeHtml(request.message)}</div>` : "";

  const actionButtons = [];
  if (request.status === "pending") {
    actionButtons.push(`<button class="btn primary small" data-action="approve" data-id="${request.id}">승인</button>`);
  }
  if (["pending", "approved"].includes(request.status)) {
    actionButtons.push(`<button class="btn small" data-action="play" data-id="${request.id}">바로 재생</button>`);
  }
  if (request.status !== "rejected" && request.status !== "played") {
    actionButtons.push(`<button class="btn danger small" data-action="reject" data-id="${request.id}">거절</button>`);
  }
  actionButtons.push(`<button class="btn ghost small" data-action="delete" data-id="${request.id}">삭제</button>`);

  return `
    <article class="song-card">
      <div class="song-head">
        <div>
          <h3 class="song-title">${escapeHtml(displayName(request))}</h3>
          <div class="song-meta">${requester} · ${youtubeLink}</div>
        </div>
        <div class="stack">
          <span class="status-pill ${request.status}">${statusLabel(request.status)}</span>
          ${themePill}
        </div>
      </div>
      ${message}
      <div class="mini-input">
        <input data-youtube-input="${request.id}" value="${escapeHtml(request.youtubeUrl || request.youtubeId || "")}" placeholder="YouTube 링크 수정" />
        <button class="btn ghost small" data-action="save-link" data-id="${request.id}">링크 저장</button>
      </div>
      <div class="actions">${actionButtons.join("")}</div>
    </article>
  `;
}

function renderList(state) {
  const items = state[stateView.activeTab] || [];
  pendingCount.textContent = state.pending.length;
  queueCount.textContent = state.queue.length;

  if (!items.length) {
    songList.innerHTML = `<div class="empty">표시할 신청곡이 없습니다.</div>`;
    return;
  }

  songList.innerHTML = items.map(renderSongCard).join("");
}

function render(state) {
  stateView.current = state;
  renderCurrent(state);
  renderSettings(state);
  renderGameEvent(state);
  renderList(state);
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    stateView.activeTab = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
    if (stateView.current) renderList(stateView.current);
  });
});

songList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  button.disabled = true;

  try {
    if (action === "save-link") {
      const input = songList.querySelector(`[data-youtube-input="${id}"]`);
      await postJson(`/api/requests/${id}/update`, { youtubeUrl: input.value });
    } else {
      await postJson(`/api/requests/${id}/${action}`);
    }
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
});

nextButton.addEventListener("click", async () => {
  nextButton.disabled = true;
  try {
    await postJson("/api/current/next");
  } catch (error) {
    alert(error.message);
  } finally {
    nextButton.disabled = false;
  }
});

clearButton.addEventListener("click", async () => {
  clearButton.disabled = true;
  try {
    await postJson("/api/current/clear");
  } catch (error) {
    alert(error.message);
  } finally {
    clearButton.disabled = false;
  }
});

announcementForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = announcementForm.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    const payload = {
      ...formPayload(announcementForm),
      durationSeconds: Number(announcementForm.elements.durationSeconds.value),
      voiceEnabled: checkboxValue(announcementForm, "voiceEnabled")
    };
    await postJson("/api/announcements", payload);
    setNotice(announcementNotice, "ok", "공지 화면과 음성 안내를 전송했습니다.");
  } catch (error) {
    setNotice(announcementNotice, "err", error.message);
  } finally {
    submitButton.disabled = false;
  }
});

clearAnnouncementButton.addEventListener("click", async () => {
  clearAnnouncementButton.disabled = true;
  try {
    await postJson("/api/announcements/clear");
    setNotice(announcementNotice, "ok", "현재 공지를 내렸습니다.");
  } catch (error) {
    setNotice(announcementNotice, "err", error.message);
  } finally {
    clearAnnouncementButton.disabled = false;
  }
});

function kitchenClosePayload() {
  return {
    ...formPayload(kitchenCloseForm),
    enabled: checkboxValue(kitchenCloseForm, "enabled"),
    voiceEnabled: checkboxValue(kitchenCloseForm, "voiceEnabled"),
    durationSeconds: Number(kitchenCloseForm.elements.durationSeconds.value)
  };
}

kitchenCloseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = kitchenCloseForm.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    await postJson("/api/settings/kitchen-close", kitchenClosePayload());
    setNotice(kitchenCloseNotice, "ok", "주방 마감 자동 안내 설정을 저장했습니다.");
  } catch (error) {
    setNotice(kitchenCloseNotice, "err", error.message);
  } finally {
    submitButton.disabled = false;
  }
});

testKitchenCloseButton.addEventListener("click", async () => {
  testKitchenCloseButton.disabled = true;
  try {
    await postJson("/api/settings/kitchen-close/test", kitchenClosePayload());
    setNotice(kitchenCloseNotice, "ok", "주방 마감 안내를 지금 디스플레이에 띄웠습니다.");
  } catch (error) {
    setNotice(kitchenCloseNotice, "err", error.message);
  } finally {
    testKitchenCloseButton.disabled = false;
  }
});

gameEventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = gameEventForm.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    await postJson("/api/game-events/start", {
      ...formPayload(gameEventForm),
      joinOpen: checkboxValue(gameEventForm, "joinOpen")
    });
    setNotice(gameEventNotice, "ok", "이벤트를 시작했습니다. 손님 신청 페이지와 디스플레이에 표시됩니다.");
  } catch (error) {
    setNotice(gameEventNotice, "err", error.message);
  } finally {
    submitButton.disabled = false;
  }
});

gameEventType.addEventListener("change", updateGameEventFields);

resolveGameEventButton.addEventListener("click", async () => {
  resolveGameEventButton.disabled = true;
  try {
    await postJson("/api/game-events/resolve", {
      bossChoice: bossChoice.value
    });
    setNotice(gameEventNotice, "ok", "게임 결과를 화면에 발표했습니다.");
  } catch (error) {
    setNotice(gameEventNotice, "err", error.message);
  } finally {
    resolveGameEventButton.disabled = false;
  }
});

drawGameWinnerButton.addEventListener("click", async () => {
  drawGameWinnerButton.disabled = true;
  try {
    await postJson("/api/game-events/draw");
    setNotice(gameEventNotice, "ok", "랜덤 추첨을 완료했습니다.");
  } catch (error) {
    setNotice(gameEventNotice, "err", error.message);
  } finally {
    drawGameWinnerButton.disabled = false;
  }
});

reopenGameEventButton.addEventListener("click", async () => {
  reopenGameEventButton.disabled = true;
  try {
    await postJson("/api/game-events/reopen");
    setNotice(gameEventNotice, "ok", "이벤트 참여를 다시 열었습니다.");
  } catch (error) {
    setNotice(gameEventNotice, "err", error.message);
  } finally {
    reopenGameEventButton.disabled = false;
  }
});

closeGameEventButton.addEventListener("click", async () => {
  closeGameEventButton.disabled = true;
  try {
    await postJson("/api/game-events/close");
    setNotice(gameEventNotice, "ok", "이벤트를 종료했습니다.");
  } catch (error) {
    setNotice(gameEventNotice, "err", error.message);
  } finally {
    closeGameEventButton.disabled = false;
  }
});

function updateManualThemeField() {
  const config = THEME_FIELDS[manualTheme.value] || THEME_FIELDS.normal;
  const input = manualForm.elements.themeName;
  manualThemeNameField.hidden = manualTheme.value === "normal";
  manualThemeNameLabel.textContent = config.label;
  input.placeholder = config.placeholder;
  if (manualTheme.value === "normal") input.value = "";
}

manualTheme.addEventListener("change", updateManualThemeField);

manualForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = manualForm.querySelector("button[type='submit']");
  const formData = new FormData(manualForm);
  submitButton.disabled = true;

  try {
    const state = await postJson("/api/requests", {
      title: formData.get("title"),
      artist: formData.get("artist"),
      youtubeUrl: formData.get("youtubeUrl"),
      requester: formData.get("requester"),
      message: formData.get("message"),
      theme: formData.get("theme"),
      themeName: formData.get("themeName"),
      source: "staff"
    });
    const created = state.requests[state.requests.length - 1];
    if (created) await postJson(`/api/requests/${created.id}/approve`);
    manualForm.reset();
    updateManualThemeField();
    setNotice(manualNotice, "ok", "신청곡을 추가하고 대기열에 넣었습니다.");
  } catch (error) {
    setNotice(manualNotice, "err", error.message);
  } finally {
    submitButton.disabled = false;
  }
});

const events = new EventSource("/api/events");
events.addEventListener("state", (event) => render(JSON.parse(event.data)));
events.onerror = () => {
  songList.innerHTML = `<div class="empty">서버 연결이 끊겼습니다. 자동 재연결을 기다리는 중입니다.</div>`;
};

updateManualThemeField();
updateGameEventFields();
