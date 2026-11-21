(function () {
  const pages = window.IELTS_VOCAB_PAGES || [];
  const STORAGE_KEY = "ielts_200_vocab_state_v5";

  let state = {
    currentPageIndex: 0,
    maxReachedPageIndex: 0,
    answers: {},        // { [questionNo]: selectedOptionIndex }
    checkedPages: {},   // { [pageNum]: true }
    submittedAll: false,
    filterMode: "all"   // "all" | "wrong" | "unanswered"
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === "object") {
      state = { ...state, ...saved };
    }
  } catch (e) {}

  if (!(state.currentPageIndex >= 0 && state.currentPageIndex < pages.length)) {
    state.currentPageIndex = 0;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  // Theme Management (defaults to Light / white screen; user can switch to Dark Mode anytime)
  const THEME_KEY = "ielts_200_vocab_theme_v1";
  const btnThemeToggle = document.getElementById("btnThemeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const themeLabel = document.getElementById("themeLabel");

  function applyTheme(mode) {
    const isDark = mode === "dark";
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    if (themeIcon) themeIcon.textContent = isDark ? "☀️" : "🌙";
    if (themeLabel) themeLabel.textContent = isDark ? "Light Mode" : "Dark Mode";
  }

  let currentTheme = "light";
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      currentTheme = savedTheme;
    }
  } catch (e) {}
  applyTheme(currentTheme);

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener("click", () => {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(currentTheme);
      try {
        localStorage.setItem(THEME_KEY, currentTheme);
      } catch (e) {}
    });
  }

  // DOM References
  const tabLessons = document.getElementById("tabLessons");
  const tabProgress = document.getElementById("tabProgress");
  const pageJumpInput = document.getElementById("pageJumpInput");
  const pageTotalLabel = document.getElementById("pageTotalLabel");
  const pageJumpInputBottom = document.getElementById("pageJumpInputBottom");
  const pageTotalLabelBottom = document.getElementById("pageTotalLabelBottom");
  const brandLink = document.getElementById("brandLink");
  const globalProgressBadge = document.getElementById("globalProgressBadge");
  const pageTitle = document.getElementById("pageTitle");

  const transcriptBox = document.getElementById("transcriptBox");
  const transcriptText = document.getElementById("transcriptText");
  const btnToggleTranscript = document.getElementById("btnToggleTranscript");

  const wordsBox = document.getElementById("wordsBox");
  const wordsListContainer = document.getElementById("wordsListContainer");
  const btnToggleWords = document.getElementById("btnToggleWords");

  const mcqSectionTop = document.getElementById("mcqSectionTop");
  const mcqCountTag = document.getElementById("mcqCountTag");
  const pageResultBanner = document.getElementById("pageResultBanner");
  const mcqContainer = document.getElementById("mcqContainer");
  const btnPrevPage = document.getElementById("btnPrevPage");
  const btnNextPage = document.getElementById("btnNextPage");
  const btnPrevPageBottom = document.getElementById("btnPrevPageBottom");
  const btnNextPageBottom = document.getElementById("btnNextPageBottom");
  const quizWorkspace = document.getElementById("quizWorkspace");
  const finalResultsView = document.getElementById("finalResultsView");
  const floatingCounter = document.getElementById("floatingCounter");
  const fcLabel = document.getElementById("fcLabel");
  const fcSelectedCount = document.getElementById("fcSelectedCount");
  const fcTotalCount = document.getElementById("fcTotalCount");
  const fcPageLabel = document.getElementById("fcPageLabel");
  const btnFloatingCheckResult = document.getElementById("btnFloatingCheckResult");

  // Audio Engine Elements
  const voiceSelect = document.getElementById("voiceSelect");
  const rateSelect = document.getElementById("rateSelect");
  const btnPlayPause = document.getElementById("btnPlayPause");
  const playIcon = document.getElementById("playIcon");
  const playLabel = document.getElementById("playLabel");
  const btnRestartAudio = document.getElementById("btnRestartAudio");
  const audioStatusText = document.getElementById("audioStatusText");
  const scrubberTrackWrap = document.getElementById("scrubberTrackWrap");
  const scrubberFill = document.getElementById("scrubberFill");
  const scrubberThumb = document.getElementById("scrubberThumb");
  const audioScrubber = document.getElementById("audioScrubber");
  const timeElapsedDisplay = document.getElementById("timeElapsedDisplay");
  const timeTotalDisplay = document.getElementById("timeTotalDisplay");

  // Sentence-chunked SpeechSynthesis Player
  const synth = window.speechSynthesis;
  let voices = [];
  let sentences = [];
  let totalChars = 0;
  let currentCharOffset = 0;
  let isPlaying = false;
  let isPaused = false;
  let playSessionId = 0;
  let rafId = null;
  let speakDelayTimer = null;
  let activeUtterance = null;
  let playAnchorTime = 0;
  let playAnchorChar = 0;
  let chunkFloorChar = 0;
  let chunkCeilChar = 0;

  function formatTime(seconds) {
    const sec = Math.max(0, Math.floor(seconds));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function getSelectedRate() {
    const allowed = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4];
    const raw = parseFloat(rateSelect.value);
    if (!Number.isFinite(raw)) return 1.0;
    return allowed.reduce((prev, curr) => Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev, 1.0);
  }

  function getCharsPerSecond() {
    return 15.5 * getSelectedRate();
  }

  function getEstimatedTotalSeconds() {
    return Math.max(5, totalChars / getCharsPerSecond());
  }

  function buildSentenceIndex(story) {
    sentences = [];
    totalChars = story.length;
    const regex = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
    let match;
    while ((match = regex.exec(story)) !== null) {
      sentences.push({
        text: match[0],
        startChar: match.index,
        endChar: match.index + match[0].length
      });
    }
  }

  function updateTimelineUI(charPos) {
    const totalSec = getEstimatedTotalSeconds();
    const ratio = totalChars > 0 ? Math.min(1, Math.max(0, charPos / totalChars)) : 0;
    const pct = (ratio * 100).toFixed(3) + "%";
    const currentSec = ratio * totalSec;
    timeElapsedDisplay.textContent = formatTime(currentSec);
    timeTotalDisplay.textContent = formatTime(totalSec);
    audioScrubber.value = Math.round(ratio * 1000);
    if (scrubberFill) scrubberFill.style.width = pct;
    if (scrubberThumb) scrubberThumb.style.left = pct;
  }

  function clearTicker() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function startSmoothTicker(session) {
    clearTicker();
    function tick() {
      if (session !== playSessionId || !isPlaying || isPaused) return;
      if (!isScrubbing) {
        const elapsedSec = (performance.now() - playAnchorTime) / 1000;
        const projected = playAnchorChar + elapsedSec * getCharsPerSecond();
        // Keep progress strictly smooth & bounded inside the active sentence so it never stutters or jumps backward
        const clamped = Math.min(chunkCeilChar, Math.max(currentCharOffset, projected));
        currentCharOffset = clamped;
        updateTimelineUI(currentCharOffset);
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function pickDefaultUSFemaleVoice() {
    if (!voices.length) return -1;
    const usFemalePatterns = [
      /google us english/i,
      /microsoft (zira|jenny|aria|ana|michelle|sara)/i,
      /samantha|ava|allison|susan|victoria|karen|moira/i,
      /female/i
    ];
    for (const pat of usFemalePatterns) {
      const idx = voices.findIndex(v => /en[-_]?US/i.test(v.lang) && pat.test(v.name));
      if (idx !== -1) return idx;
    }
    const anyUS = voices.findIndex(v => /en[-_]?US/i.test(v.lang));
    if (anyUS !== -1) return anyUS;
    const anyFemale = voices.findIndex(v => /female/i.test(v.name));
    if (anyFemale !== -1) return anyFemale;
    return 0;
  }

  function populateVoices() {
    if (!synth) return;
    const all = synth.getVoices();
    voices = all.filter(v => v.lang && v.lang.toLowerCase().startsWith("en"));
    if (voices.length === 0) voices = all;

    const previousName = voiceSelect.options[voiceSelect.selectedIndex]?.dataset?.voiceName;
    voiceSelect.innerHTML = "";

    const defaultIdx = pickDefaultUSFemaleVoice();
    voices.forEach((v, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.dataset.voiceName = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      if (previousName ? v.name === previousName : idx === defaultIdx) {
        opt.selected = true;
      }
      voiceSelect.appendChild(opt);
    });
  }

  if (synth) {
    populateVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = populateVoices;
    }
  }

  function setPlayButtonState(playing, paused) {
    if (playing && !paused) {
      playIcon.textContent = "⏸";
      playLabel.textContent = "Pause";
    } else if (paused) {
      playIcon.textContent = "▶";
      playLabel.textContent = "Resume";
    } else {
      playIcon.textContent = "▶";
      playLabel.textContent = "Play Audio";
    }
  }

  function clearSpeakDelay() {
    if (speakDelayTimer !== null) {
      clearTimeout(speakDelayTimer);
      speakDelayTimer = null;
    }
  }

  function stopAudio(resetPosition) {
    playSessionId++;
    clearTicker();
    clearSpeakDelay();
    activeUtterance = null;
    if (synth) {
      try {
        if (synth.paused) synth.resume();
        synth.cancel();
      } catch (e) {}
    }
    isPlaying = false;
    isPaused = false;
    if (resetPosition) {
      currentCharOffset = 0;
      updateTimelineUI(0);
      audioStatusText.textContent = "Ready — press Play Audio or drag the timebar";
    }
    setPlayButtonState(false, false);
  }

  function speakFromCharOffset(startChar) {
    if (!synth) {
      audioStatusText.textContent = "Browser speech synthesis unavailable — open Transcript to read.";
      return;
    }

    playSessionId++;
    const session = playSessionId;
    clearTicker();
    clearSpeakDelay();
    activeUtterance = null;

    const wasActive = synth.speaking || synth.pending || synth.paused;
    try {
      if (synth.paused) synth.resume();
      synth.cancel();
    } catch (e) {}

    currentCharOffset = Math.max(0, Math.min(totalChars, startChar));
    if (currentCharOffset >= totalChars - 2) {
      currentCharOffset = 0;
    }

    // Snap mid-word resume points cleanly to the start of the current word so TTS never pronounces broken word fragments
    if (currentCharOffset > 0 && currentCharOffset < totalChars) {
      const fullStory = pages[state.currentPageIndex]?.story || "";
      while (currentCharOffset > 0 && !/\s/.test(fullStory.charAt(currentCharOffset - 1))) {
        currentCharOffset--;
      }
    }

    let startSentenceIdx = sentences.findIndex(s => currentCharOffset < s.endChar);
    if (startSentenceIdx === -1) startSentenceIdx = 0;

    isPlaying = true;
    isPaused = false;
    setPlayButtonState(true, false);
    const activeRate = getSelectedRate();
    audioStatusText.textContent = `Playing discussion audio (${activeRate.toFixed(2).replace(/\.00$/, ".0")}x)…`;
    playAnchorTime = performance.now();
    playAnchorChar = currentCharOffset;
    chunkFloorChar = currentCharOffset;
    chunkCeilChar = sentences[startSentenceIdx] ? sentences[startSentenceIdx].endChar : totalChars;
    startSmoothTicker(session);

    function speakSentenceAt(idx) {
      if (session !== playSessionId || !isPlaying || isPaused) return;
      if (idx >= sentences.length) {
        isPlaying = false;
        isPaused = false;
        activeUtterance = null;
        currentCharOffset = totalChars;
        clearTicker();
        updateTimelineUI(totalChars);
        setPlayButtonState(false, false);
        audioStatusText.textContent = "Finished — click Check Result or move to the next page.";
        return;
      }

      const sent = sentences[idx];
      const sliceOffset = idx === startSentenceIdx ? Math.max(0, currentCharOffset - sent.startChar) : 0;
      const textToSpeak = sent.text.slice(sliceOffset).trim();
      const baseChar = sent.startChar + sliceOffset;

      if (!textToSpeak) {
        speakSentenceAt(idx + 1);
        return;
      }

      chunkFloorChar = Math.max(currentCharOffset, baseChar);
      chunkCeilChar = sent.endChar;
      playAnchorTime = performance.now();
      playAnchorChar = chunkFloorChar;

      const utter = new SpeechSynthesisUtterance(textToSpeak);
      activeUtterance = utter; // Prevent Chromium/WebKit garbage collection mid-utterance
      const selectedVoice = voices[parseInt(voiceSelect.value, 10)];
      if (selectedVoice) utter.voice = selectedVoice;
      utter.rate = getSelectedRate();
      utter.pitch = 1.0;

      utter.onboundary = (ev) => {
        if (session !== playSessionId || !isPlaying || isPaused) return;
        if (typeof ev.charIndex === "number" && ev.charIndex > 0) {
          const actualChar = Math.min(sent.endChar, baseChar + ev.charIndex);
          // Re-anchor smoothly without backward jumps
          playAnchorTime = performance.now();
          playAnchorChar = Math.max(currentCharOffset, actualChar);
        }
      };

      utter.onend = () => {
        if (session !== playSessionId) return;
        activeUtterance = null;
        currentCharOffset = Math.max(currentCharOffset, sent.endChar);
        playAnchorTime = performance.now();
        playAnchorChar = currentCharOffset;
        speakSentenceAt(idx + 1);
      };

      utter.onerror = (ev) => {
        if (session !== playSessionId) return;
        activeUtterance = null;
        if (ev && (ev.error === "interrupted" || ev.error === "canceled")) return;
        clearTicker();
        isPlaying = false;
        isPaused = false;
        setPlayButtonState(false, false);
        audioStatusText.textContent = "Playback stopped — click Play Audio to resume.";
      };

      synth.speak(utter);
    }

    // Allow browser SpeechSynthesis queue to flush after cancel() before starting new rate/voice utterance
    if (wasActive) {
      speakDelayTimer = setTimeout(() => {
        speakDelayTimer = null;
        if (session === playSessionId && isPlaying && !isPaused) {
          playAnchorTime = performance.now();
          speakSentenceAt(startSentenceIdx);
        }
      }, 65);
    } else {
      speakSentenceAt(startSentenceIdx);
    }
  }

  function pauseAudio() {
    if (!isPlaying || isPaused) return;
    playSessionId++;
    clearTicker();
    clearSpeakDelay();
    activeUtterance = null;
    if (synth) {
      try {
        if (synth.paused) synth.resume();
        synth.cancel();
      } catch (e) {}
    }
    isPlaying = false;
    isPaused = true;
    setPlayButtonState(false, true);
    updateTimelineUI(currentCharOffset);
    audioStatusText.textContent = `Paused at ${timeElapsedDisplay.textContent}`;
  }

  btnPlayPause.addEventListener("click", () => {
    if (isPlaying && !isPaused) {
      pauseAudio();
    } else {
      speakFromCharOffset(currentCharOffset);
    }
  });

  btnRestartAudio.addEventListener("click", () => {
    stopAudio(true);
    speakFromCharOffset(0);
  });

  rateSelect.addEventListener("change", () => {
    updateTimelineUI(currentCharOffset);
    if (isPlaying && !isPaused) {
      speakFromCharOffset(currentCharOffset);
    }
  });

  voiceSelect.addEventListener("change", () => {
    if (isPlaying && !isPaused) {
      speakFromCharOffset(currentCharOffset);
    }
  });

  let isScrubbing = false;

  function ratioFromClientX(clientX) {
    const rect = scrubberTrackWrap.getBoundingClientRect();
    if (!rect.width) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function applyScrubRatio(ratio, commitPlayback) {
    const targetChar = Math.round(ratio * totalChars);
    currentCharOffset = targetChar;
    updateTimelineUI(targetChar);
    if (commitPlayback) {
      if (isPlaying || isPaused) {
        speakFromCharOffset(targetChar);
      } else {
        audioStatusText.textContent = `Position set to ${timeElapsedDisplay.textContent} — press Play Audio`;
      }
    }
  }

  scrubberTrackWrap.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    isScrubbing = true;
    if (scrubberTrackWrap.setPointerCapture) {
      try { scrubberTrackWrap.setPointerCapture(e.pointerId); } catch (err) {}
    }
    applyScrubRatio(ratioFromClientX(e.clientX), false);
  });

  scrubberTrackWrap.addEventListener("pointermove", (e) => {
    if (!isScrubbing) return;
    applyScrubRatio(ratioFromClientX(e.clientX), false);
  });

  function finishScrub(e) {
    if (!isScrubbing) return;
    isScrubbing = false;
    applyScrubRatio(ratioFromClientX(e.clientX), true);
  }

  scrubberTrackWrap.addEventListener("pointerup", finishScrub);
  scrubberTrackWrap.addEventListener("pointercancel", finishScrub);

  audioScrubber.addEventListener("input", () => {
    applyScrubRatio(parseInt(audioScrubber.value, 10) / 1000, false);
  });

  audioScrubber.addEventListener("change", () => {
    applyScrubRatio(parseInt(audioScrubber.value, 10) / 1000, true);
  });

  function closeAllDrawers() {
    wordsBox.classList.add("hidden");
    btnToggleWords.classList.remove("active-toggle");
    transcriptBox.classList.add("hidden");
    btnToggleTranscript.classList.remove("active-toggle");
  }

  btnToggleWords.addEventListener("click", () => {
    const willOpen = wordsBox.classList.contains("hidden");
    closeAllDrawers();
    if (willOpen) {
      wordsBox.classList.remove("hidden");
      btnToggleWords.classList.add("active-toggle");
    }
  });

  btnToggleTranscript.addEventListener("click", () => {
    const willOpen = transcriptBox.classList.contains("hidden");
    closeAllDrawers();
    if (willOpen) {
      transcriptBox.classList.remove("hidden");
      btnToggleTranscript.classList.add("active-toggle");
    }
  });

  function highlightStoryWords(storyText, questions) {
    const words = questions.map(q => q.word).sort((a, b) => b.length - a.length);
    const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp("\\b(" + escaped.join("|") + ")\\b", "gi");
    return storyText.replace(pattern, '<span class="vocab-highlight">$1</span>');
  }

  function isPageComplete(pageObj) {
    return pageObj.questions.every(q => typeof state.answers[q.no] === "number");
  }

  function updateFloatingCounter(pageObj) {
    if (!floatingCounter || !pageObj) return;
    if (state.submittedAll) {
      floatingCounter.classList.add("hidden");
      return;
    }
    floatingCounter.classList.remove("hidden");
    const total = pageObj.questions.length;
    const isChecked = !!state.checkedPages[pageObj.page];

    if (isChecked) {
      const { correct } = getPageStats(pageObj);
      floatingCounter.classList.add("is-result");
      floatingCounter.classList.remove("is-complete");
      if (fcLabel) fcLabel.textContent = "Result!";
      if (fcSelectedCount) fcSelectedCount.textContent = correct;
      if (fcTotalCount) fcTotalCount.textContent = total;
      if (fcPageLabel) fcPageLabel.textContent = "Answers Correct";
    } else {
      const selected = pageObj.questions.filter(q => typeof state.answers[q.no] === "number").length;
      floatingCounter.classList.remove("is-result");
      floatingCounter.classList.toggle("is-complete", selected === total && total > 0);
      if (fcLabel) fcLabel.textContent = "Selected";
      if (fcSelectedCount) fcSelectedCount.textContent = selected;
      if (fcTotalCount) fcTotalCount.textContent = total;
      if (fcPageLabel) fcPageLabel.textContent = `Page ${pageObj.page} of ${pages.length}`;
    }
  }

  function checkCurrentPageResult() {
    const pageObj = pages[state.currentPageIndex];
    state.checkedPages[pageObj.page] = true;
    saveState();
    renderWorkspaceKeepScroll();
    mcqSectionTop.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (btnFloatingCheckResult) {
    btnFloatingCheckResult.addEventListener("click", checkCurrentPageResult);
  }

  function getWordFrontIconHtml(isChecked, hasAnswer, isCorrect) {
    if (!isChecked) {
      return `<span class="q-word-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>`;
    }
    if (!hasAnswer) {
      return `<span class="q-word-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="8"/></svg></span>`;
    }
    if (isCorrect) {
      return `<span class="q-word-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`;
    }
    return `<span class="q-word-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
  }

  function getPageStats(pageObj) {
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    pageObj.questions.forEach(q => {
      const chosen = state.answers[q.no];
      if (typeof chosen !== "number") {
        unanswered++;
      } else if (chosen === q.correctIndex) {
        correct++;
      } else {
        incorrect++;
      }
    });
    return { correct, incorrect, unanswered, total: pageObj.questions.length };
  }

  // ---- Navigation: tabs, page box, previous / next ----
  function goToPage(idx) {
    if (!(idx >= 0 && idx < pages.length)) return;
    stopAudio(true);
    state.submittedAll = false;
    state.currentPageIndex = idx;
    if (idx > (state.maxReachedPageIndex || 0)) state.maxReachedPageIndex = idx;
    saveState();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showProgressTab() {
    stopAudio(true);
    state.submittedAll = true;
    saveState();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Updates tabs + page box (name kept so older calls still work)
  function renderStepper() {
    const onProgress = !!state.submittedAll;
    tabLessons.classList.toggle("active", !onProgress);
    tabProgress.classList.toggle("active", onProgress);
    tabLessons.setAttribute("aria-selected", String(!onProgress));
    tabProgress.setAttribute("aria-selected", String(onProgress));
    pageTotalLabel.textContent = pages.length;
    pageJumpInput.value = String(pages[state.currentPageIndex].page);
    if (pageTotalLabelBottom) pageTotalLabelBottom.textContent = pages.length;
    if (pageJumpInputBottom) pageJumpInputBottom.value = String(pages[state.currentPageIndex].page);
    const isFirst = state.currentPageIndex === 0;
    const nextLabel = state.currentPageIndex === pages.length - 1 ? "Finish →" : "Next Page →";
    btnPrevPage.disabled = isFirst;
    btnPrevPageBottom.disabled = isFirst;
    btnNextPage.textContent = nextLabel;
    btnNextPageBottom.textContent = nextLabel;
    document.getElementById("pageNav").classList.toggle("hidden", onProgress);
  }

  tabLessons.addEventListener("click", () => goToPage(state.currentPageIndex));
  tabProgress.addEventListener("click", showProgressTab);
  brandLink.addEventListener("click", (e) => { e.preventDefault(); goToPage(state.currentPageIndex); });

  function bindPageJumpInput(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener("focus", () => inputEl.select());
    inputEl.addEventListener("input", () => {
      inputEl.value = inputEl.value.replace(/\D/g, "");
    });
    inputEl.addEventListener("change", () => {
      const n = parseInt(inputEl.value, 10);
      if (Number.isFinite(n) && n >= 1 && n <= pages.length) {
        if (n - 1 !== state.currentPageIndex) goToPage(n - 1);
      } else {
        inputEl.value = String(pages[state.currentPageIndex].page);
      }
      inputEl.blur();
    });
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); inputEl.blur(); }
      if (e.key === "Escape") { inputEl.value = String(pages[state.currentPageIndex].page); inputEl.blur(); }
    });
  }
  bindPageJumpInput(pageJumpInput);
  bindPageJumpInput(pageJumpInputBottom);

  // Clean Result Summary Bar with ONLY the 3 categories (Correct, Incorrect, Unanswered)
  function retakeCurrentPage(pageObj) {
    pageObj.questions.forEach(q => {
      delete state.answers[q.no];
    });
    delete state.checkedPages[pageObj.page];
    saveState();
    render();
    mcqSectionTop.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderPageResultBanner(pageObj) {
    const isChecked = !!state.checkedPages[pageObj.page];
    if (!isChecked) {
      pageResultBanner.classList.add("hidden");
      pageResultBanner.innerHTML = "";
      return;
    }

    const { correct, incorrect, unanswered, total } = getPageStats(pageObj);
    const pct = Math.round((correct / total) * 100);

    pageResultBanner.classList.remove("hidden");
    pageResultBanner.innerHTML = `
      <div class="summary-header-left">
        <span class="summary-score-chip">${pct}%</span>
        <div class="summary-title-group">
          <span class="summary-kicker">Page ${pageObj.page} of ${pages.length}</span>
          <h4>Result Summary</h4>
        </div>
      </div>
      <div class="summary-header-right">
        <div class="summary-stats-row">
          <span class="summary-stat is-correct"><span class="stat-ico" aria-hidden="true">✓</span> Correct: <strong>${correct}</strong></span>
          <span class="summary-stat is-incorrect"><span class="stat-ico" aria-hidden="true">✕</span> Incorrect: <strong>${incorrect}</strong></span>
          <span class="summary-stat is-unanswered"><span class="stat-ico" aria-hidden="true">○</span> Unanswered: <strong>${unanswered}</strong></span>
        </div>
        <button type="button" class="btn-retake-clean" id="btnRetakePage" title="Unlock and retake this page">↻ Retake Test</button>
      </div>
    `;

    const retakeBtn = document.getElementById("btnRetakePage");
    if (retakeBtn) {
      retakeBtn.addEventListener("click", () => retakeCurrentPage(pageObj));
    }
  }

  // Right option is always highlighted in GREEN when checked; options lock until Retake Test
  function getOptionClasses(q, optIdx, chosen, isChecked) {
    const isCorrectAnswer = optIdx === q.correctIndex;
    const isSelected = chosen === optIdx;

    let cls = "option-label";
    if (isSelected) cls += " selected";

    if (isChecked) {
      cls += " is-locked";
      if (isCorrectAnswer) {
        cls += " opt-green";
      } else if (isSelected) {
        cls += " opt-wrong";
      }
    }
    return cls;
  }

  function renderWorkspace() {
    quizWorkspace.classList.remove("hidden");
    finalResultsView.classList.add("hidden");
    closeAllDrawers();

    const pageObj = pages[state.currentPageIndex];

    if (globalProgressBadge) globalProgressBadge.textContent = `Page ${pageObj.page} of ${pages.length}`;
    pageTitle.textContent = pageObj.title;
    if (mcqCountTag) mcqCountTag.textContent = `(${pageObj.questions.length} MCQs)`;

    buildSentenceIndex(pageObj.story);
    currentCharOffset = 0;
    updateTimelineUI(0);

    wordsListContainer.innerHTML = pageObj.questions.map((q) => {
      const capWord = q.word ? q.word.charAt(0).toUpperCase() + q.word.slice(1) : "";
      const posPart = q.pos ? ` ${q.pos}` : "";
      const lowerMeaning = q.meaning ? q.meaning.charAt(0).toLowerCase() + q.meaning.slice(1) : "";
      return `
        <div class="word-row-item">
          <span class="word-row-term">${q.no}. ${capWord}${posPart}</span>
          <span class="word-row-def">${lowerMeaning}</span>
        </div>
      `;
    }).join("");

    transcriptText.innerHTML = highlightStoryWords(pageObj.story, pageObj.questions);

    renderPageResultBanner(pageObj);

    const isChecked = !!state.checkedPages[pageObj.page];

    mcqContainer.innerHTML = "";
    pageObj.questions.forEach((q) => {
      const card = document.createElement("div");
      const chosen = state.answers[q.no];
      const hasAnswer = typeof chosen === "number";
      const isCorrect = hasAnswer && chosen === q.correctIndex;

      let cardClasses = "mcq-card";
      if (hasAnswer) cardClasses += " answered";
      if (isChecked) {
        if (!hasAnswer) cardClasses += " checked-unanswered";
        else cardClasses += isCorrect ? " checked-correct" : " checked-wrong";
      }
      card.className = cardClasses;
      card.id = `q-card-${q.no}`;

      const optionsHtml = q.options.map((optText, optIdx) => {
        const checkedAttr = chosen === optIdx ? "checked" : "";
        const disabledAttr = isChecked ? "disabled" : "";
        const optClass = getOptionClasses(q, optIdx, chosen, isChecked);
        const capOpt = optText ? optText.charAt(0).toUpperCase() + optText.slice(1) : "";
        return `
          <label class="${optClass}" data-opt-idx="${optIdx}" role="radio" aria-checked="${chosen === optIdx ? "true" : "false"}">
            <input type="radio" name="q_${q.no}" value="${optIdx}" ${checkedAttr} ${disabledAttr} />
            <span class="opt-radio-circle" aria-hidden="true"></span>
            <span>${capOpt}</span>
          </label>
        `;
      }).join("");

      let statusBadgeHtml = "";
      if (isChecked) {
        if (!hasAnswer) {
          statusBadgeHtml = `<span class="q-badge unans">Unanswered</span>`;
        } else if (isCorrect) {
          statusBadgeHtml = `<span class="q-badge ok">Correct</span>`;
        } else {
          statusBadgeHtml = `<span class="q-badge err">Incorrect</span>`;
        }
      }

      const capMcqWord = q.word ? q.word.charAt(0).toUpperCase() + q.word.slice(1) : "";
      const wordIconHtml = getWordFrontIconHtml(isChecked, hasAnswer, isCorrect);

      card.innerHTML = `
        <div class="q-header">
          <div class="q-word-wrap">
            ${wordIconHtml}
            <span class="q-word">${capMcqWord}</span>
          </div>
          ${statusBadgeHtml}
        </div>
        <div class="options-grid-two">${optionsHtml}</div>
      `;

      // 1st click = select (fill circle), 2nd click on same = unselect (unfill circle), 3rd click = select again
      // Clicking another option selects that option and unselects the previous one
      card.querySelectorAll(".option-label").forEach((lbl, optIdx) => {
        lbl.addEventListener("click", (e) => {
          if (state.checkedPages[pageObj.page]) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          const allRadios = card.querySelectorAll('input[type="radio"]');
          if (state.answers[q.no] === optIdx) {
            delete state.answers[q.no];
            allRadios.forEach((r) => { r.checked = false; });
          } else {
            state.answers[q.no] = optIdx;
            allRadios.forEach((r, idx) => { r.checked = (idx === optIdx); });
          }
          saveState();
          renderWorkspaceKeepScroll();
          renderStepper();
        });
      });

      mcqContainer.appendChild(card);
    });

    updateFloatingCounter(pageObj);
  }

  function renderWorkspaceKeepScroll() {
    const pageObj = pages[state.currentPageIndex];
    const isChecked = !!state.checkedPages[pageObj.page];
    renderPageResultBanner(pageObj);
    updateFloatingCounter(pageObj);

    pageObj.questions.forEach((q) => {
      const card = document.getElementById(`q-card-${q.no}`);
      if (!card) return;
      const chosen = state.answers[q.no];
      const hasAnswer = typeof chosen === "number";
      const isCorrect = hasAnswer && chosen === q.correctIndex;

      let cardClasses = "mcq-card";
      if (hasAnswer) cardClasses += " answered";
      if (isChecked) {
        if (!hasAnswer) cardClasses += " checked-unanswered";
        else cardClasses += isCorrect ? " checked-correct" : " checked-wrong";
      }
      card.className = cardClasses;

      const labels = card.querySelectorAll(".option-label");
      labels.forEach((lbl, idx) => {
        lbl.className = getOptionClasses(q, idx, chosen, isChecked);
        lbl.setAttribute("aria-checked", chosen === idx ? "true" : "false");
        const inp = lbl.querySelector('input[type="radio"]');
        if (inp) {
          inp.disabled = isChecked;
          inp.checked = (chosen === idx);
        }
      });

      const topRow = card.querySelector(".q-header");
      const wordWrap = topRow.querySelector(".q-word-wrap");
      if (wordWrap) {
        const oldIcon = wordWrap.querySelector(".q-word-icon");
        if (oldIcon) oldIcon.remove();
        wordWrap.insertAdjacentHTML("afterbegin", getWordFrontIconHtml(isChecked, hasAnswer, isCorrect));
      }
      let badge = topRow.querySelector(".q-badge");
      if (isChecked) {
        if (!badge) {
          badge = document.createElement("span");
          topRow.appendChild(badge);
        }
        if (!hasAnswer) {
          badge.className = "q-badge unans";
          badge.textContent = "Unanswered";
        } else if (isCorrect) {
          badge.className = "q-badge ok";
          badge.textContent = "Correct";
        } else {
          badge.className = "q-badge err";
          badge.textContent = "Incorrect";
        }
      }
    });

  }



  btnPrevPage.addEventListener("click", () => {
    if (state.currentPageIndex > 0) goToPage(state.currentPageIndex - 1);
  });

  function goNext() {
    if (state.currentPageIndex < pages.length - 1) goToPage(state.currentPageIndex + 1);
    else showProgressTab();
  }
  function goPrev() {
    if (state.currentPageIndex > 0) goToPage(state.currentPageIndex - 1);
  }
  btnNextPage.addEventListener("click", goNext);
  btnNextPageBottom.addEventListener("click", goNext);
  btnPrevPageBottom.addEventListener("click", goPrev);

  function renderFinalResults() {
    quizWorkspace.classList.add("hidden");
    finalResultsView.classList.remove("hidden");
    if (floatingCounter) floatingCounter.classList.add("hidden");
    if (globalProgressBadge) globalProgressBadge.textContent = "Final Scorecard";

    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalUnanswered = 0;

    pages.forEach(p => {
      p.questions.forEach(q => {
        totalQuestions++;
        const chosen = state.answers[q.no];
        if (typeof chosen !== "number") totalUnanswered++;
        else if (chosen === q.correctIndex) totalCorrect++;
        else totalIncorrect++;
      });
    });

    const pct = Math.round((totalCorrect / totalQuestions) * 100);
    const answered = totalCorrect + totalIncorrect;
    const pagesChecked = pages.filter(p => state.checkedPages[p.page]).length;
    const pagesDone = pages.filter(p => isPageComplete(p)).length;
    const accuracy = answered ? Math.round((totalCorrect / answered) * 100) : 0;

    const pageRows = pages.map(p => {
      const st = getPageStats(p);
      const cp = (st.correct / st.total) * 100;
      const ip = (st.incorrect / st.total) * 100;
      const pp = Math.round(cp);
      return `
        <button type="button" class="pp-row" data-goto="${p.page - 1}" title="Open lesson ${p.page}">
          <span class="pp-num">Page ${p.page}</span>
          <span class="pp-title">${p.title}</span>
          <span class="pp-bar" aria-hidden="true">
            <span class="pp-seg pp-ok" style="width:${cp}%"></span>
            <span class="pp-seg pp-bad" style="width:${ip}%"></span>
          </span>
          <span class="pp-score">${st.correct}/${st.total} <em>${pp}%</em></span>
        </button>`;
    }).join("");

    let html = `
      <div class="progress-hero">
        <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
        <div class="hero-text">
          <h2>Overall Progress</h2>
          <p>${answered} of ${totalQuestions} words answered &middot; accuracy on answered words ${accuracy}%</p>
        </div>
      </div>

      <div class="stat-tiles">
        <div class="stat-tile is-correct"><strong>${totalCorrect}</strong><span>Correct</span></div>
        <div class="stat-tile is-incorrect"><strong>${totalIncorrect}</strong><span>Incorrect</span></div>
        <div class="stat-tile is-unanswered"><strong>${totalUnanswered}</strong><span>Unanswered</span></div>
        <div class="stat-tile"><strong>${pagesDone}/${pages.length}</strong><span>Pages completed</span></div>
        <div class="stat-tile"><strong>${pagesChecked}/${pages.length}</strong><span>Pages checked</span></div>
      </div>

      <div class="page-progress-card">
        <h3 class="section-main-title">Progress by page</h3>
        <div class="pp-list">${pageRows}</div>
      </div>

      <div class="results-toolbar">
        <div class="stat-group">
          <button type="button" class="btn ${state.filterMode === "all" ? "btn-primary" : "btn-secondary"}" id="btnShowAllRes">All (${totalQuestions})</button>
          <button type="button" class="btn ${state.filterMode === "wrong" ? "btn-primary" : "btn-secondary"}" id="btnShowWrongRes">Incorrect (${totalIncorrect})</button>
          <button type="button" class="btn ${state.filterMode === "unanswered" ? "btn-primary" : "btn-secondary"}" id="btnShowUnansRes">Unanswered (${totalUnanswered})</button>
        </div>
        <div class="stat-group">
          <button type="button" class="btn btn-secondary" id="btnBackToPages">← Back to Lessons</button>
          <button type="button" class="btn btn-secondary" id="btnResetAll">Reset Progress</button>
        </div>
      </div>
    `;

    pages.forEach(p => {
      const stats = getPageStats(p);
      const visible = p.questions.filter(q => {
        const chosen = state.answers[q.no];
        if (state.filterMode === "wrong") return typeof chosen === "number" && chosen !== q.correctIndex;
        if (state.filterMode === "unanswered") return typeof chosen !== "number";
        return true;
      });

      if (visible.length === 0) return;

      html += `
        <div class="review-group">
          <div class="review-group-head">
            <span>Page ${p.page} — ${p.title}</span>
            <span>Correct: ${stats.correct} | Incorrect: ${stats.incorrect} | Unanswered: ${stats.unanswered}</span>
          </div>
      `;

      visible.forEach(q => {
        const chosenIdx = state.answers[q.no];
        const hasAnswer = typeof chosenIdx === "number";
        const isCorrect = hasAnswer && chosenIdx === q.correctIndex;
        const chosenText = hasAnswer ? q.options[chosenIdx] : "Unanswered";

        let cardCls = "review-card ";
        let badgeHtml = "";
        if (!hasAnswer) {
          cardCls += "is-unans";
          badgeHtml = `<span class="q-badge unans">Unanswered</span>`;
        } else if (isCorrect) {
          cardCls += "is-correct";
          badgeHtml = `<span class="q-badge ok">Correct</span>`;
        } else {
          cardCls += "is-wrong";
          badgeHtml = `<span class="q-badge err">Incorrect</span>`;
        }

        html += `
          <div class="${cardCls}">
            <div class="review-card-top">
              <strong>#${q.no} ${q.word_pos}</strong>
              ${badgeHtml}
            </div>
            <div class="review-line"><strong>Selected:</strong> ${chosenText}</div>
            ${!isCorrect ? `<div class="review-line" style="color: var(--green-ink);"><strong>Correct Meaning:</strong> ${q.meaning}</div>` : ""}
            <div class="review-extra">
              <strong>Synonyms:</strong> ${q.synonym} &nbsp;•&nbsp;
              <strong>Antonyms:</strong> ${q.antonym}<br/>
              <strong>Example:</strong> <em>"${q.example}"</em>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    });

    finalResultsView.innerHTML = html;

    document.getElementById("btnShowAllRes").addEventListener("click", () => {
      state.filterMode = "all";
      renderFinalResults();
    });
    document.getElementById("btnShowWrongRes").addEventListener("click", () => {
      state.filterMode = "wrong";
      renderFinalResults();
    });
    document.getElementById("btnShowUnansRes").addEventListener("click", () => {
      state.filterMode = "unanswered";
      renderFinalResults();
    });
    document.getElementById("btnBackToPages").addEventListener("click", () => goToPage(state.currentPageIndex));
    finalResultsView.querySelectorAll("[data-goto]").forEach(btn => {
      btn.addEventListener("click", () => goToPage(Number(btn.dataset.goto)));
    });
    document.getElementById("btnResetAll").addEventListener("click", () => {
      if (confirm("Clear all selected answers and restart from Page 1?")) {
        state.answers = {};
        state.checkedPages = {};
        state.currentPageIndex = 0;
        state.submittedAll = false;
        saveState();
        render();
      }
    });
  }

  function render() {
    renderStepper();
    if (state.submittedAll) {
      renderFinalResults();
    } else {
      renderWorkspace();
    }
  }

  render();
})();
