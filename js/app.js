/**
 * app.js
 * Main Application Controller, Interactive Study Workspace, 3GPP Protocol Calculators,
 * 115-Question Telecom Bank, Mock Exam Engine, and Official Hardcover Book Print Engine.
 */

(function () {
  "use strict";

  const DATA = window.HANDBOOK_DATA;
  const FMT = window.HandbookFormatter;

  if (!DATA || !FMT) {
    console.error("HANDBOOK_DATA or HandbookFormatter failed to load.");
    return;
  }

  const STORAGE_KEY = "ubiverse_cpp_5g_handbook_state_v1";

  const DEFAULT_STATE = {
    currentView: "overview",
    theme: "light", // 'light' | 'sepia' | 'dark'
    font: "serif", // 'serif' | 'sans'
    scale: "standard", // 'compact' | 'standard' | 'large'
    activeRecall: false,
    bookPreviewMode: false,
    printScope: "all", // 'all' | 'vol1' | 'vol2' | 'current'
    includeMcqsInPrint: false,
    completedCppSubtopics: {},
    completedNrTopics: {},
    masteredQuestions: {},
    bookmarks: {},
    checklist: {},
    // Protocol calculator states
    slivS: 2,
    slivL: 12,
    slivDecodeInput: 55,
    ollaBler: 10.0,
    ollaUp: 0.1,
    // QBank filter states
    qbankCategory: "ALL",
    qbankDifficulty: "ALL",
    qbankSearch: "",
    qbankUnmasteredOnly: false
  };

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_STATE,
        ...parsed,
        completedCppSubtopics: parsed.completedCppSubtopics || {},
        completedNrTopics: parsed.completedNrTopics || {},
        masteredQuestions: parsed.masteredQuestions || {},
        bookmarks: parsed.bookmarks || {},
        checklist: parsed.checklist || {}
      };
    } catch (e) {
      return { ...DEFAULT_STATE };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore quota errors
    }
  }

  // =========================================================================
  // Dataset Indexing & Metrics Computation
  // =========================================================================

  const cppDays = (DATA.cpp && DATA.cpp.days) || [];
  const nrWeeks = (DATA.nr && (DATA.nr.weeks || DATA.nr.studyPlan)) || [];
  const nrEvolution = (DATA.nr && DATA.nr.evolutionMatrix) || [];
  const nrTop15 = (DATA.nr && DATA.nr.topInterviewQuestions) || [];
  const nrDrills = (DATA.nr && DATA.nr.calculationDrills) || [];
  const nrDiagnostics = (DATA.nr && DATA.nr.diagnosticPackets) || [];
  const nrDesigns = (DATA.nr && DATA.nr.systemDesigns) || [];
  const nrQuestions = Array.isArray(DATA.nrQuestionBank)
    ? DATA.nrQuestionBank
    : (DATA.nrQuestionBank && DATA.nrQuestionBank.questions) || [];
  const nrExtras = DATA.nrExtras || {};

  function getDayTitle(d) {
    return d.topic || d.title || `Day ${d.day}`;
  }

  function getDayMcqs(d) {
    const subMcqs = (d.subtopics || []).flatMap((s) => s.mcqs || []);
    if (subMcqs.length > 0) return subMcqs;
    return d.mcqs || [];
  }

  // Compute totals
  const totalCppSubtopics = cppDays.reduce((acc, d) => acc + (d.subtopics ? d.subtopics.length : 0), 0);
  const totalCppQuestions = cppDays.reduce(
    (acc, d) =>
      acc +
      (d.subtopics
        ? d.subtopics.reduce(
            (s, sub) => s + ((sub.questions || sub.interview_questions || []).length),
            0
          )
        : 0),
    0
  );
  const totalCppMcqs = cppDays.reduce((acc, d) => acc + getDayMcqs(d).length, 0);
  const totalNrTopics = nrWeeks.reduce((acc, w) => acc + (w.topics ? w.topics.length : 0), 0);
  const totalNrQuestions = nrQuestions.length;

  // Navigation structure for Prev/Next Pager
  const NAV_ORDER = [
    { id: "overview", title: "Executive Overview & Study Command Center", short: "Overview" },
    ...cppDays.map((d) => ({
      id: `cpp-day-${d.day}`,
      title: `Chapter ${d.day}: ${getDayTitle(d)}`,
      short: `Day ${d.day}: ${getDayTitle(d)}`
    })),
    ...nrWeeks.map((w) => ({
      id: `nr-week-${w.week}`,
      title: `Chapter ${21 + w.week} (NR Week ${w.week}): ${w.title}`,
      short: `Week ${w.week}: ${w.title}`
    })),
    { id: "nr-protocol-lab", title: "Chapter 32: 3GPP Protocol Calculators, Math Drills & 4G/5G Matrix", short: "Protocol Lab & Drills" },
    { id: "nr-diagnostics-designs", title: "Chapter 33: QXDM Diagnostics, NACK Storm Triage & L2 System Designs", short: "QXDM & System Designs" },
    { id: "nr-top15", title: "Chapter 34: Top 15 High-Yield 5G NR L2 Interview Questions", short: "Top 15 NR Q&As" },
    { id: "nr-qbank", title: "Chapter 35: Complete 115-Question Telecom MAC & RTOS Compendium", short: "115-Question Bank" },
    { id: "career-playbook", title: "Chapter 36: Senior Engineering Job-Switch Playbook & Pitch Guide", short: "Career Playbook" }
  ];

  // =========================================================================
  // Theme, Typography & Body Class Synchronization
  // =========================================================================

  function applyPreferencesToDOM() {
    const html = document.documentElement;
    const body = document.body;

    html.setAttribute("data-theme", state.theme);
    html.setAttribute("data-font", state.font);
    html.setAttribute("data-scale", state.scale);

    body.classList.toggle("active-recall-mode", !!state.activeRecall);
    body.classList.toggle("book-preview-mode", !!state.bookPreviewMode);
    body.classList.toggle("exclude-mcqs-in-print", !state.includeMcqsInPrint);

    // Sync topbar buttons
    const btnRecall = document.getElementById("btn-toggle-recall");
    if (btnRecall) {
      btnRecall.classList.toggle("active", !!state.activeRecall);
      btnRecall.innerHTML = state.activeRecall
        ? `<span>🙈</span> Active Recall: ON`
        : `<span>👁️</span> Active Recall: OFF`;
    }

    const btnBookMode = document.getElementById("btn-toggle-book-mode");
    if (btnBookMode) {
      btnBookMode.classList.toggle("active", !!state.bookPreviewMode);
      btnBookMode.innerHTML = state.bookPreviewMode
        ? `<span>📖</span> Exit Book Preview`
        : `<span>📖</span> Book Preview Mode`;
    }

    const themeSelect = document.getElementById("select-theme");
    if (themeSelect) themeSelect.value = state.theme;

    const fontSelect = document.getElementById("select-font");
    if (fontSelect) fontSelect.value = state.font;

    const scaleSelect = document.getElementById("select-scale");
    if (scaleSelect) scaleSelect.value = state.scale;

    updateTopbarProgress();
  }

  function computeOverallProgress() {
    const doneCpp = Object.keys(state.completedCppSubtopics).filter((k) => state.completedCppSubtopics[k]).length;
    const doneNr = Object.keys(state.completedNrTopics).filter((k) => state.completedNrTopics[k]).length;
    const doneQ = Object.keys(state.masteredQuestions).filter((k) => state.masteredQuestions[k]).length;

    const totalItems = totalCppSubtopics + totalNrTopics + totalNrQuestions;
    const doneItems = doneCpp + doneNr + doneQ;
    const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    return {
      doneCpp,
      doneNr,
      doneQ,
      totalItems,
      doneItems,
      pct
    };
  }

  function updateTopbarProgress() {
    const prog = computeOverallProgress();
    const fillEl = document.getElementById("topbar-progress-fill");
    const textEl = document.getElementById("topbar-progress-text");
    if (fillEl) fillEl.style.width = `${prog.pct}%`;
    if (textEl) textEl.textContent = `${prog.pct}% (${prog.doneItems}/${prog.totalItems})`;
  }

  // =========================================================================
  // Left Sidebar Navigation Rendering
  // =========================================================================

  function renderSidebar() {
    const container = document.getElementById("sidebar-nav-content");
    if (!container) return;

    const cppPhases = [
      { label: "Part I: C++ Foundations & Memory (Days 1–5)", min: 1, max: 5 },
      { label: "Part II: OOP, RAII & Polymorphism (Days 6–8)", min: 6, max: 8 },
      { label: "Part III: Templates, STL & Modern C++ (Days 9–11)", min: 9, max: 11 },
      { label: "Part IV: Concurrency, Patterns & Perf (Days 12–14)", min: 12, max: 14 },
      { label: "Part V: FAANG DSA & System Design (Days 15–16)", min: 15, max: 16 },
      { label: "Part VI: Revision, C++20/23 & Lock-Free (Days 17–21)", min: 17, max: 21 }
    ];

    let html = `
      <div class="nav-group">
        <div class="nav-group-header">
          <span>Command Center & Book Controls</span>
        </div>
        <div class="nav-item ${state.currentView === "overview" ? "active" : ""}" data-view="overview">
          <span class="nav-item-code">HOME</span>
          <span class="nav-item-title">Executive Study Dashboard</span>
        </div>
        <div class="nav-item ${state.currentView === "career-playbook" ? "active" : ""}" data-view="career-playbook">
          <span class="nav-item-code">CH 36</span>
          <span class="nav-item-title">Job-Switch Pitch & Playbook</span>
          <span class="nav-item-badge">MUST</span>
        </div>
      </div>

      <div class="nav-group">
        <div class="nav-group-header">
          <span>Vol III: 5G NR Lab & 115 Q&A Bank</span>
        </div>
        <div class="nav-item ${state.currentView === "nr-protocol-lab" ? "active" : ""}" data-view="nr-protocol-lab">
          <span class="nav-item-code">CH 32</span>
          <span class="nav-item-title">SLIV / OLLA Lab & Math Drills</span>
          <span class="nav-item-badge">LAB</span>
        </div>
        <div class="nav-item ${state.currentView === "nr-diagnostics-designs" ? "active" : ""}" data-view="nr-diagnostics-designs">
          <span class="nav-item-code">CH 33</span>
          <span class="nav-item-title">QXDM Logs & 4 L2 System Designs</span>
          <span class="nav-item-badge">ARCH</span>
        </div>
        <div class="nav-item ${state.currentView === "nr-top15" ? "active" : ""}" data-view="nr-top15">
          <span class="nav-item-code">CH 34</span>
          <span class="nav-item-title">Top 15 High-Yield 5G NR Q&As</span>
          <span class="nav-item-badge">15</span>
        </div>
        <div class="nav-item ${state.currentView === "nr-qbank" ? "active" : ""}" data-view="nr-qbank">
          <span class="nav-item-code">CH 35</span>
          <span class="nav-item-title">115 Telecom & RTOS Q&A Bank</span>
          <span class="nav-item-badge">${Object.keys(state.masteredQuestions).filter((k) => state.masteredQuestions[k]).length}/115</span>
        </div>
      </div>

      <div class="nav-group">
        <div class="nav-group-header">
          <span>Vol II: 3GPP 5G NR MAC & CA (10 Wks)</span>
          <span>40 Topics</span>
        </div>
        ${nrWeeks
          .map((w) => {
            const viewId = `nr-week-${w.week}`;
            const topics = w.topics || [];
            const doneCount = topics.filter((t) => state.completedNrTopics[t.id]).length;
            const allDone = topics.length > 0 && doneCount === topics.length;
            return `
              <div class="nav-item ${state.currentView === viewId ? "active" : ""} ${allDone ? "completed" : ""}" data-view="${viewId}">
                <span class="nav-item-code">WK ${w.week}</span>
                <span class="nav-item-title">${FMT.escapeHtml(w.title)}</span>
                <span class="nav-item-badge">${doneCount}/${topics.length}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    for (const phase of cppPhases) {
      const daysInPhase = cppDays.filter((d) => d.day >= phase.min && d.day <= phase.max);
      html += `
        <div class="nav-group">
          <div class="nav-group-header">
            <span>${FMT.escapeHtml(phase.label)}</span>
          </div>
          ${daysInPhase
            .map((d) => {
              const viewId = `cpp-day-${d.day}`;
              const subs = d.subtopics || [];
              const doneCount = subs.filter((s) => state.completedCppSubtopics[s.id]).length;
              const allDone = subs.length > 0 && doneCount === subs.length;
              return `
                <div class="nav-item ${state.currentView === viewId ? "active" : ""} ${allDone ? "completed" : ""}" data-view="${viewId}">
                  <span class="nav-item-code">DAY ${d.day}</span>
                  <span class="nav-item-title">${FMT.escapeHtml(getDayTitle(d))}</span>
                  <span class="nav-item-badge">${doneCount}/${subs.length}</span>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    }

    container.innerHTML = html;

    container.querySelectorAll(".nav-item[data-view]").forEach((el) => {
      el.addEventListener("click", () => {
        const targetView = el.getAttribute("data-view");
        if (state.bookPreviewMode) {
          // If in book preview mode, scroll to the chapter if present, or exit book mode
          const anchor = document.getElementById(`chapter-anchor-${targetView}`);
          if (anchor) {
            anchor.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          state.bookPreviewMode = false;
        }
        navigateTo(targetView);
      });
    });
  }

  function navigateTo(viewId, scrollToId = null) {
    state.currentView = viewId;
    saveState();
    applyPreferencesToDOM();
    renderSidebar();
    renderMainContent();
    if (scrollToId) {
      setTimeout(() => {
        const el = document.getElementById(scrollToId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  // =========================================================================
  // Right-Hand Page Outline (Table of Contents for Active Chapter)
  // =========================================================================

  function renderPageOutline() {
    const outlineContainer = document.getElementById("page-outline-links");
    if (!outlineContainer) return;

    const mainEl = document.getElementById("main-canvas");
    if (!mainEl) return;

    const sections = mainEl.querySelectorAll("[data-outline-id]");
    if (sections.length === 0) {
      outlineContainer.innerHTML = `<div style="font-size:0.78rem;color:var(--text-muted);padding:6px 10px;">Select any chapter to view section jumps.</div>`;
      return;
    }

    outlineContainer.innerHTML = Array.from(sections)
      .map((sec) => {
        const id = sec.getAttribute("data-outline-id");
        const label = sec.getAttribute("data-outline-label") || id;
        return `<a href="#${FMT.escapeHtml(id)}" class="outline-link" data-target="${FMT.escapeHtml(id)}">${FMT.escapeHtml(label)}</a>`;
      })
      .join("");

    outlineContainer.querySelectorAll(".outline-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetId = link.getAttribute("data-target");
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  // =========================================================================
  // Reusable Chapter Components (C++ Chapters & 5G NR Chapters)
  // =========================================================================

  function renderPager(currentViewId) {
    const idx = NAV_ORDER.findIndex((item) => item.id === currentViewId);
    if (idx === -1) return "";
    const prev = idx > 0 ? NAV_ORDER[idx - 1] : null;
    const next = idx < NAV_ORDER.length - 1 ? NAV_ORDER[idx + 1] : null;

    return `
      <nav class="chapter-pager no-print">
        ${
          prev
            ? `<div class="pager-btn prev" data-nav="${prev.id}">
                 <span class="pager-dir">← Previous Chapter</span>
                 <span class="pager-title">${FMT.escapeHtml(prev.short)}</span>
               </div>`
            : `<div></div>`
        }
        ${
          next
            ? `<div class="pager-btn next" data-nav="${next.id}">
                 <span class="pager-dir">Next Chapter →</span>
                 <span class="pager-title">${FMT.escapeHtml(next.short)}</span>
               </div>`
            : `<div></div>`
        }
      </nav>
    `;
  }

  function renderCppDayChapter(dayObj, isFullBookRender = false) {
    const dayNum = dayObj.day;
    const dayTitle = getDayTitle(dayObj);
    const subtopics = dayObj.subtopics || [];
    const mcqs = getDayMcqs(dayObj);
    const viewId = `cpp-day-${dayNum}`;

    const sectionsHtml = subtopics
      .map((sub, idx) => {
        const secNum = `§ ${dayNum}.${idx + 1}`;
        const isDone = !!state.completedCppSubtopics[sub.id];
        const isBookmarked = !!state.bookmarks[sub.id];
        const codeExamples = Array.isArray(sub.examples)
          ? sub.examples
          : sub.code_example
          ? [sub.code_example]
          : [];
        const tips = sub.tips_to_remember || sub.important_tips || [];
        const pitfalls = sub.pitfalls || sub.common_pitfalls || [];
        const qas = sub.questions || sub.interview_questions || [];

        const codeFiguresHtml = codeExamples
          .map((codeEx, exIdx) => {
            const rawCode = codeEx ? codeEx.formatted_code || codeEx.code || "" : "";
            if (!rawCode) return "";
            const figLabel =
              codeExamples.length > 1
                ? `Listing ${dayNum}.${idx + 1}.${exIdx + 1}`
                : `Listing ${dayNum}.${idx + 1}`;
            return `
              <figure class="code-figure">
                <div class="code-figure-header">
                  <div class="code-figure-title">
                    <span class="code-lang-tag">C++20/23</span>
                    <span>${figLabel} — ${FMT.escapeHtml(codeEx.title || sub.title)}</span>
                  </div>
                  <button class="copy-code-btn no-print" data-copy-code="${encodeURIComponent(rawCode)}">Copy Code</button>
                </div>
                <div class="code-pre">${FMT.highlightCppCode(rawCode, true)}</div>
                ${
                  codeEx.explanation
                    ? `<figcaption class="code-explanation-footer"><strong>Compiler & Memory Walkthrough:</strong> ${FMT.renderInlineMarkdown(codeEx.explanation)}</figcaption>`
                    : ""
                }
              </figure>
            `;
          })
          .join("");

        return `
          <section class="book-section" id="sec-${FMT.escapeHtml(sub.id)}" data-outline-id="sec-${FMT.escapeHtml(sub.id)}" data-outline-label="${secNum} ${sub.title}">
            <div class="section-header-row">
              <div class="section-title-group">
                <div class="section-badge-row">
                  <span class="section-number-badge">${secNum}</span>
                  <span class="section-spec-badge">ID: ${FMT.escapeHtml(sub.id)}</span>
                </div>
                <h2 class="section-title">${FMT.escapeHtml(sub.title)}</h2>
              </div>
              <div class="section-actions no-print">
                <button class="action-chip ${isDone ? "completed" : ""}" data-toggle-cpp="${FMT.escapeHtml(sub.id)}" title="Mark Subtopic Completed">
                  ${isDone ? "✓ Completed" : "○ Mark Complete"}
                </button>
                <button class="action-chip ${isBookmarked ? "bookmarked" : ""}" data-toggle-bookmark="${FMT.escapeHtml(sub.id)}" title="Bookmark Section">
                  ${isBookmarked ? "★ Bookmarked" : "☆ Bookmark"}
                </button>
              </div>
            </div>

            ${FMT.renderRichExplanation(sub.explanation)}

            ${codeFiguresHtml}

            ${
              tips.length > 0 || pitfalls.length > 0
                ? `
                  <div class="callout-dual-grid">
                    ${
                      tips.length > 0
                        ? `
                          <aside class="callout-box callout-tips">
                            <div class="callout-header">
                              <span class="callout-icon">✓</span>
                              <span class="callout-title">Senior Engineering Best Practices & Memory Hooks</span>
                            </div>
                            <ul class="callout-list">
                              ${tips.map((t) => `<li>${FMT.renderInlineMarkdown(t)}</li>`).join("")}
                            </ul>
                          </aside>
                        `
                        : ""
                    }
                    ${
                      pitfalls.length > 0
                        ? `
                          <aside class="callout-box callout-pitfalls">
                            <div class="callout-header">
                              <span class="callout-icon">⚠️</span>
                              <span class="callout-title">Undefined Behavior, Traps & Interview Pitfalls</span>
                            </div>
                            <ul class="callout-list">
                              ${pitfalls.map((p) => `<li>${FMT.renderInlineMarkdown(p)}</li>`).join("")}
                            </ul>
                          </aside>
                        `
                        : ""
                    }
                  </div>
                `
                : ""
            }

            ${
              qas.length > 0
                ? `
                  <div class="qa-section-block">
                    <div class="qa-section-header">
                      <span class="qa-section-title">🎯 Senior Technical Interview Questions (${qas.length})</span>
                      <span class="section-spec-badge no-print">Click any question card in Active Recall mode to reveal</span>
                    </div>
                    ${qas
                      .map(
                        (qa, qIdx) => `
                          <div class="qa-card">
                            <div class="qa-question-bar" data-toggle-qa>
                              <div class="qa-q-prefix">
                                <span class="qa-q-badge">Q${idx + 1}.${qIdx + 1}</span>
                                <span class="qa-q-title">${FMT.renderInlineMarkdown(qa.question)}</span>
                              </div>
                              <span class="qa-reveal-hint no-print">Click to Reveal / Hide</span>
                            </div>
                            <div class="qa-answer-body">
                              ${FMT.renderFormattedContentBlock(qa.answer)}
                            </div>
                          </div>
                        `
                      )
                      .join("")}
                  </div>
                `
                : ""
            }
          </section>
        `;
      })
      .join("");

    const mcqsHtml =
      mcqs.length > 0
        ? `
          <section class="book-section mcq-section-block" id="sec-day-${dayNum}-mcqs" data-outline-id="sec-day-${dayNum}-mcqs" data-outline-label="§ ${dayNum}.${subtopics.length + 1} Rapid-Fire MCQs (${mcqs.length})">
            <div class="section-header-row">
              <div class="section-title-group">
                <div class="section-badge-row">
                  <span class="section-number-badge">§ ${dayNum}.${subtopics.length + 1}</span>
                  <span class="section-spec-badge">${mcqs.length} Assessment Items</span>
                </div>
                <h2 class="section-title">Chapter ${dayNum} Rapid-Fire Multiple Choice Verification (${mcqs.length} Questions)</h2>
              </div>
              <div class="section-actions no-print">
                <button class="btn btn-primary" data-launch-day-quiz="${dayNum}">⚡ Launch Interactive Day ${dayNum} Quiz</button>
              </div>
            </div>
            <div class="mcq-grid">
              ${mcqs
                .map((m, mIdx) => {
                  const opts = m.options || [];
                  const correctIdx =
                    m.correct_option !== undefined ? Number(m.correct_option) : Number(m.correct_answer);
                  const letters = ["A", "B", "C", "D", "E", "F"];
                  return `
                    <div class="mcq-card" data-mcq-correct="${correctIdx}">
                      <div class="mcq-q-text">
                        <span class="mcq-num">#${mIdx + 1}</span>
                        ${FMT.renderInlineMarkdown(m.question)}
                      </div>
                      <div class="mcq-options">
                        ${opts
                          .map(
                            (opt, oIdx) => `
                              <div class="mcq-opt ${oIdx === correctIdx ? "is-correct-opt" : ""}" data-mcq-opt="${oIdx}">
                                <span class="mcq-opt-letter">${letters[oIdx] || oIdx + 1}.</span>
                                <span>${FMT.renderInlineMarkdown(opt)}</span>
                              </div>
                            `
                          )
                          .join("")}
                      </div>
                      <div class="mcq-exp">
                        <strong>✓ Answer (${letters[correctIdx] || correctIdx + 1}):</strong> ${FMT.renderInlineMarkdown(m.explanation || "")}
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </section>
        `
        : "";

    return `
      <article class="book-chapter" id="chapter-anchor-${viewId}">
        <div class="chapter-running-header">
          <span>Volume I — Modern C++17/20/23, DSA & Systems Engineering</span>
          <span>Chapter ${dayNum}: ${FMT.escapeHtml(dayTitle)}</span>
        </div>
        <header class="chapter-opener">
          <div class="chapter-meta-row">
            <span class="chapter-number-pill">Volume I • Chapter ${dayNum} (Day ${dayNum} of 21)</span>
            <span class="chapter-hours-pill">⏱ ${dayObj.estimated_hours || 5} Hours Intensive</span>
            <span class="chapter-hours-pill">📚 ${subtopics.length} Sections • ${mcqs.length} MCQs</span>
          </div>
          <h1 class="chapter-title">Chapter ${dayNum}: ${FMT.escapeHtml(dayTitle)}</h1>
          <p class="chapter-summary">Comprehensive deep-dive across ${subtopics.map((s) => `<strong>${FMT.escapeHtml(s.title)}</strong>`).join(" • ")}.</p>
        </header>
        ${sectionsHtml}
        ${mcqsHtml}
        ${!isFullBookRender ? renderPager(viewId) : ""}
      </article>
    `;
  }

  function renderNrWeekChapter(weekObj, isFullBookRender = false) {
    const weekNum = weekObj.week;
    const chapNum = 21 + weekNum;
    const topics = weekObj.topics || [];
    const viewId = `nr-week-${weekNum}`;

    const sectionsHtml = topics
      .map((topic, idx) => {
        const secNum = `§ ${chapNum}.${idx + 1}`;
        const isDone = !!state.completedNrTopics[topic.id];
        const isBookmarked = !!state.bookmarks[topic.id];
        const formulas = topic.keyFormulas || [];
        const aids = topic.memoryAids || [];
        const pitfalls = topic.pitfalls || [];
        const codeSnippet = topic.codeSnippet || "";

        return `
          <section class="book-section" id="sec-${FMT.escapeHtml(topic.id)}" data-outline-id="sec-${FMT.escapeHtml(topic.id)}" data-outline-label="${secNum} ${topic.title}">
            <div class="section-header-row">
              <div class="section-title-group">
                <div class="section-badge-row">
                  <span class="section-number-badge">${secNum}</span>
                  <span class="section-spec-badge">📜 ${FMT.escapeHtml(topic.specClause || "3GPP Rel-17")}</span>
                  <span class="section-spec-badge">ID: ${FMT.escapeHtml(topic.id)}</span>
                </div>
                <h2 class="section-title">${FMT.escapeHtml(topic.title)}</h2>
              </div>
              <div class="section-actions no-print">
                <button class="action-chip ${isDone ? "completed" : ""}" data-toggle-nr="${FMT.escapeHtml(topic.id)}">
                  ${isDone ? "✓ Completed" : "○ Mark Complete"}
                </button>
                <button class="action-chip ${isBookmarked ? "bookmarked" : ""}" data-toggle-bookmark="${FMT.escapeHtml(topic.id)}">
                  ${isBookmarked ? "★ Bookmarked" : "☆ Bookmark"}
                </button>
              </div>
            </div>

            ${FMT.renderRichExplanation(topic.explanation)}

            ${
              formulas.length > 0
                ? `
                  <aside class="callout-box callout-formulas">
                    <div class="callout-header">
                      <span class="callout-icon">📐</span>
                      <span class="callout-title">Normative 3GPP Equations & Closed-Form identities (${FMT.escapeHtml(topic.specClause || "TS 38.214")})</span>
                    </div>
                    <div class="formula-list">
                      ${formulas.map((f) => `<div class="formula-item">${FMT.escapeHtml(f)}</div>`).join("")}
                    </div>
                  </aside>
                `
                : ""
            }

            ${
              codeSnippet
                ? `
                  <figure class="code-figure">
                    <div class="code-figure-header">
                      <div class="code-figure-title">
                        <span class="code-lang-tag">L2 Baseband C++20</span>
                        <span>Listing ${chapNum}.${idx + 1} — Deterministic Baseband Implementation (${FMT.escapeHtml(topic.id)})</span>
                      </div>
                      <button class="copy-code-btn no-print" data-copy-code="${encodeURIComponent(codeSnippet)}">Copy Code</button>
                    </div>
                    <div class="code-pre">${FMT.highlightCppCode(codeSnippet, true)}</div>
                  </figure>
                `
                : ""
            }

            ${
              aids.length > 0 || pitfalls.length > 0
                ? `
                  <div class="callout-dual-grid">
                    ${
                      aids.length > 0
                        ? `
                          <aside class="callout-box callout-tips">
                            <div class="callout-header">
                              <span class="callout-icon">🧠</span>
                              <span class="callout-title">Memory Hooks & High-Speed Recall Rules</span>
                            </div>
                            <ul class="callout-list">
                              ${aids.map((a) => `<li>${FMT.renderInlineMarkdown(a)}</li>`).join("")}
                            </ul>
                          </aside>
                        `
                        : ""
                    }
                    ${
                      pitfalls.length > 0
                        ? `
                          <aside class="callout-box callout-pitfalls">
                            <div class="callout-header">
                              <span class="callout-icon">⚠️</span>
                              <span class="callout-title">3GPP Specification Traps & Field Failure Modes</span>
                            </div>
                            <ul class="callout-list">
                              ${pitfalls.map((p) => `<li>${FMT.renderInlineMarkdown(p)}</li>`).join("")}
                            </ul>
                          </aside>
                        `
                        : ""
                    }
                  </div>
                `
                : ""
            }
          </section>
        `;
      })
      .join("");

    return `
      <article class="book-chapter" id="chapter-anchor-${viewId}">
        <div class="chapter-running-header">
          <span>Volume II — 3GPP 5G NR L2 MAC Downlink & Carrier Aggregation</span>
          <span>Chapter ${chapNum} (Week ${weekNum}): ${FMT.escapeHtml(weekObj.title)}</span>
        </div>
        <header class="chapter-opener">
          <div class="chapter-meta-row">
            <span class="chapter-number-pill">Volume II • Chapter ${chapNum} (Week ${weekNum} of 10)</span>
            <span class="chapter-phase-pill">${FMT.escapeHtml(weekObj.phase || "3GPP L2 Architecture")}</span>
            <span class="chapter-hours-pill">📜 ${topics.length} Deep-Dive Spec Clauses</span>
          </div>
          <h1 class="chapter-title">Chapter ${chapNum}: ${FMT.escapeHtml(weekObj.title)}</h1>
          <p class="chapter-summary">${FMT.renderInlineMarkdown(weekObj.summary || "")}</p>
          ${
            weekObj.deliverable
              ? `<div class="chapter-deliverable-banner">🛠️ <strong>Engineering Milestone Deliverable:</strong> ${FMT.renderInlineMarkdown(weekObj.deliverable)}</div>`
              : ""
          }
        </header>
        ${sectionsHtml}
        ${!isFullBookRender ? renderPager(viewId) : ""}
      </article>
    `;
  }

  // =========================================================================
  // Chapter 32: Interactive 5G NR Protocol Lab, Calculation Drills & 4G/5G Matrix
  // =========================================================================

  function renderProtocolLabChapter(isFullBookRender = false) {
    const slivVal = FMT.encodeSliv(state.slivS, state.slivL);
    const decoded = FMT.decodeSliv(state.slivDecodeInput);
    const olla = FMT.computeOlla(state.ollaBler, state.ollaUp);
    const formulasSheet = nrExtras.formulasCheatSheet || [];

    const symbolsHtml = Array.from({ length: 14 }, (_, symIdx) => {
      const isAllocated =
        slivVal !== null && symIdx >= state.slivS && symIdx < state.slivS + state.slivL;
      const isDmrs = isAllocated && symIdx === state.slivS;
      return `
        <div class="slot-sym ${isAllocated ? "allocated" : ""} ${isDmrs ? "dmrs" : ""}" title="Symbol ${symIdx}">
          <span>${symIdx}</span>
          <span style="font-size:0.55rem;">${isDmrs ? "DMRS" : isAllocated ? "PDSCH" : "—"}</span>
        </div>
      `;
    }).join("");

    return `
      <article class="book-chapter" id="chapter-anchor-nr-protocol-lab">
        <div class="chapter-running-header">
          <span>Volume III — 5G NR Protocol Lab, Calculations & Evolution Matrix</span>
          <span>Chapter 32: Normative 3GPP Math & Protocol Calculators</span>
        </div>
        <header class="chapter-opener">
          <div class="chapter-meta-row">
            <span class="chapter-number-pill">Volume III • Chapter 32</span>
            <span class="chapter-phase-pill">TS 38.211 / TS 38.212 / TS 38.214</span>
          </div>
          <h1 class="chapter-title">Chapter 32: 3GPP 5G NR Protocol Lab, Step-by-Step Math Drills & 4G/5G Evolution Matrix</h1>
          <p class="chapter-summary">Interactive 3GPP TS 38.214 SLIV & OLLA baseband calculators, 8 normative closed-form formulas, 4 step-by-step whiteboard calculation drills, and the 9-dimension 4G LTE vs 5G NR architectural comparison matrix.</p>
        </header>

        <!-- Section 32.1: Interactive Baseband Calculators -->
        <section class="book-section" id="sec-lab-calculators" data-outline-id="sec-lab-calculators" data-outline-label="§ 32.1 Interactive SLIV & OLLA Calculators">
          <div class="section-header-row">
            <div class="section-title-group">
              <div class="section-badge-row">
                <span class="section-number-badge">§ 32.1</span>
                <span class="section-spec-badge">TS 38.214 §5.1.2.1 & OLLA Loop</span>
              </div>
              <h2 class="section-title">Interactive TS 38.214 SLIV (Start & Length Indicator Value) & OLLA Calculators</h2>
            </div>
          </div>

          <div class="lab-grid">
            <!-- SLIV Calculator Card -->
            <div class="lab-card">
              <div class="lab-card-header">
                <div class="lab-card-title">📡 TS 38.214 §5.1.2.1 SLIV Encoder & 14-Symbol OFDM Slot Visualizer</div>
                <div class="lab-card-sub">Jointly encodes Starting Symbol <code>S ∈ [0,13]</code> and Allocation Length <code>L ∈ [1, 14-S]</code> into a 7-bit integer (0–104).</div>
              </div>
              <div class="lab-card-body">
                <div class="calc-row no-print">
                  <label>Start Symbol <code>S</code> (0–13):</label>
                  <input type="range" id="input-sliv-s" min="0" max="13" step="1" value="${state.slivS}">
                  <span class="calc-val-badge" id="label-sliv-s">S = ${state.slivS}</span>
                </div>
                <div class="calc-row no-print">
                  <label>Length <code>L</code> (1–14 Symbols):</label>
                  <input type="range" id="input-sliv-l" min="1" max="14" step="1" value="${state.slivL}">
                  <span class="calc-val-badge" id="label-sliv-l">L = ${state.slivL}</span>
                </div>

                <div class="slot-visualizer" id="sliv-slot-grid">
                  ${symbolsHtml}
                </div>

                <div class="calc-result-box" id="sliv-result-box">
                  ${
                    slivVal !== null
                      ? `<strong>Valid Allocation (S=${state.slivS}, L=${state.slivL}, End=${state.slivS + state.slivL - 1}):</strong><br>
                         Branch: <code>(L - 1) = ${state.slivL - 1} ${state.slivL - 1 <= 7 ? "≤ 7  ⇒  14×(L-1) + S" : "> 7  ⇒  14×(14-L+1) + (14-1-S)"}</code><br>
                         <strong>Encoded SLIV = ${slivVal}</strong> (Hex: <code>0x${slivVal.toString(16).toUpperCase().padStart(2, "0")}</code>)`
                      : `<span style="color:var(--danger);">⚠️ Invalid PDSCH Allocation: S + L = ${state.slivS + state.slivL} exceeds 14 OFDM symbols per slot!</span>`
                  }
                </div>

                <hr style="border:none;border-top:1px solid var(--border-subtle);margin:14px 0;">
                <div class="calc-row no-print">
                  <label>Reverse Decode SLIV (0–104):</label>
                  <input type="number" id="input-sliv-decode" min="0" max="127" value="${state.slivDecodeInput}" style="width:90px;padding:4px 8px;border:1px solid var(--border-strong);border-radius:4px;font-family:var(--font-mono);">
                  <span class="calc-val-badge" id="label-sliv-decode">
                    ${decoded && decoded.valid ? `S=${decoded.S}, L=${decoded.L}` : "Invalid"}
                  </span>
                </div>
              </div>
            </div>

            <!-- OLLA Calculator Card -->
            <div class="lab-card">
              <div class="lab-card-header">
                <div class="lab-card-title">⚖️ Outer Loop Link Adaptation (OLLA) Equilibrium Calculator</div>
                <div class="lab-card-sub">Computes exact ACK step-down <code>Δ_down</code> given NACK penalty <code>Δ_up</code> and Target BLER so <code>E[Δ_offset] = 0</code>.</div>
              </div>
              <div class="lab-card-body">
                <div class="calc-row no-print">
                  <label>Target BLER (%):</label>
                  <input type="range" id="input-olla-bler" min="1" max="30" step="0.5" value="${state.ollaBler}">
                  <span class="calc-val-badge" id="label-olla-bler">${state.ollaBler.toFixed(1)}%</span>
                </div>
                <div class="calc-row no-print">
                  <label>NACK Step-Up <code>Δ_up</code> (dB):</label>
                  <input type="range" id="input-olla-up" min="0.05" max="1.0" step="0.05" value="${state.ollaUp}">
                  <span class="calc-val-badge" id="label-olla-up">${state.ollaUp.toFixed(2)} dB</span>
                </div>

                <div class="calc-result-box" id="olla-result-box">
                  <strong>Steady-State Convergence Equation:</strong><br>
                  <code>P(NACK)·Δ_up − P(ACK)·Δ_down = 0</code><br>
                  <code>Δ_down = Δ_up × [ BLER / (1 − BLER) ]</code><br><br>
                  • Target BLER: <strong>${state.ollaBler.toFixed(1)}%</strong> (${olla.blerRatio.toFixed(3)})<br>
                  • On HARQ NACK (subtract from SINR_eff): <strong>−${olla.deltaUp.toFixed(3)} dB</strong><br>
                  • On HARQ ACK (add to SINR_eff): <strong>+${olla.deltaDown.toFixed(4)} dB</strong><br>
                  • Equilibrium Ratio: <strong>${olla.ackPerNack.toFixed(1)} ACKs</strong> required to offset <strong>1 NACK</strong>.
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 32.2: Normative 3GPP Formula Reference Sheet -->
        <section class="book-section" id="sec-lab-formulas" data-outline-id="sec-lab-formulas" data-outline-label="§ 32.2 8 Core 3GPP Closed-Form Formulas">
          <div class="section-header-row">
            <div class="section-title-group">
              <div class="section-badge-row">
                <span class="section-number-badge">§ 32.2</span>
                <span class="section-spec-badge">Whiteboard Reference</span>
              </div>
              <h2 class="section-title">Normative 3GPP Closed-Form Formula Reference Sheet</h2>
            </div>
          </div>
          <div class="table-wrap">
            <table class="spec-table">
              <thead>
                <tr>
                  <th style="width:22%;">Protocol Mechanism</th>
                  <th style="width:16%;">3GPP Spec Clause</th>
                  <th style="width:38%;">Closed-Form Equation</th>
                  <th style="width:24%;">Baseband Engineering Notes</th>
                </tr>
              </thead>
              <tbody>
                ${formulasSheet
                  .map(
                    (f) => `
                      <tr>
                        <td><strong>${FMT.escapeHtml(f.name)}</strong></td>
                        <td><span class="section-spec-badge">${FMT.escapeHtml(f.spec)}</span></td>
                        <td><code class="inline-code inline-code-bold">${FMT.escapeHtml(f.formula)}</code></td>
                        <td>${FMT.renderInlineMarkdown(f.notes)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Section 32.3: 4 Step-by-Step 3GPP Calculation Drills -->
        <section class="book-section" id="sec-lab-drills" data-outline-id="sec-lab-drills" data-outline-label="§ 32.3 4 Step-by-Step Calculation Drills">
          <div class="section-header-row">
            <div class="section-title-group">
              <div class="section-badge-row">
                <span class="section-number-badge">§ 32.3</span>
                <span class="section-spec-badge">4 Whiteboard Numerical Drills</span>
              </div>
              <h2 class="section-title">Step-by-Step 3GPP Baseband Calculation Drills</h2>
            </div>
          </div>

          ${nrDrills
            .map(
              (drill, idx) => `
                <div class="qa-card">
                  <div class="qa-question-bar" data-toggle-qa>
                    <div class="qa-q-prefix">
                      <span class="qa-q-badge">${FMT.escapeHtml(drill.id || `DRILL 32.${idx + 1}`)}</span>
                      <span class="qa-q-title">${FMT.escapeHtml(drill.title)} (${FMT.escapeHtml(drill.specClause || "3GPP TS 38.214")})</span>
                    </div>
                    <span class="qa-reveal-hint no-print">Click to Reveal Solution</span>
                  </div>
                  <div class="qa-answer-body">
                    ${
                      drill.scenario
                        ? `<p class="prose-p"><strong>Scenario:</strong> ${FMT.renderInlineMarkdown(drill.scenario)}</p>`
                        : ""
                    }
                    <aside class="callout-box callout-formulas" style="margin-top:0;">
                      <div class="callout-header">
                        <span class="callout-icon">📋</span>
                        <span class="callout-title">Problem Statement (${FMT.escapeHtml(drill.specClause || "")})</span>
                      </div>
                      <div class="callout-body">${FMT.renderFormattedContentBlock(drill.problemStatement || drill.formula || "")}</div>
                    </aside>
                    ${FMT.renderFormattedContentBlock(drill.stepByStepSolution)}
                    <div class="chapter-deliverable-banner" style="margin-top:10px;">
                      🎯 <strong>Verified Answer:</strong> ${FMT.renderInlineMarkdown(drill.verifiedAnswer || drill.finalAnswer || "")}
                    </div>
                  </div>
                </div>
              `
            )
            .join("")}
        </section>

        <!-- Section 32.4: 4G LTE vs 5G NR Evolution Matrix -->
        <section class="book-section" id="sec-lab-evolution" data-outline-id="sec-lab-evolution" data-outline-label="§ 32.4 4G LTE vs 5G NR Evolution Matrix">
          <div class="section-header-row">
            <div class="section-title-group">
              <div class="section-badge-row">
                <span class="section-number-badge">§ 32.4</span>
                <span class="section-spec-badge">9 Architectural Dimensions</span>
              </div>
              <h2 class="section-title">4G LTE vs. 5G NR L1/L2 Architectural Evolution Matrix</h2>
            </div>
          </div>

          <div class="table-wrap">
            <table class="spec-table">
              <thead>
                <tr>
                  <th style="width:16%;">Feature / Layer</th>
                  <th style="width:24%;">4G LTE (TS 36.21x / 36.321)</th>
                  <th style="width:32%;">5G NR (TS 38.21x / 38.321)</th>
                  <th style="width:28%;">Architectural Paradigm Shift ("Why?")</th>
                </tr>
              </thead>
              <tbody>
                ${nrEvolution
                  .map(
                    (row) => `
                      <tr>
                        <td><strong>${FMT.escapeHtml(row.dimension || row.feature || "")}</strong></td>
                        <td>${FMT.renderInlineMarkdown(row.lte || row.lte4G || "")}</td>
                        <td>${FMT.renderInlineMarkdown(row.nr || row.nr5G || "")}</td>
                        <td>${FMT.renderInlineMarkdown(row.impact || row.architecturalShift || "")}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>

        ${!isFullBookRender ? renderPager("nr-protocol-lab") : ""}
      </article>
    `;
  }

  // =========================================================================
  // Chapter 33: QXDM Diagnostics, NACK Storm Triage & 4 L2 System Designs
  // =========================================================================

  function renderDiagnosticsAndDesignsChapter(isFullBookRender = false) {
    const nackTree = nrExtras.nackStormDecisionTree || [];

    return `
      <article class="book-chapter" id="chapter-anchor-nr-diagnostics-designs">
        <div class="chapter-running-header">
          <span>Volume III — QXDM Field Diagnostics & L2 Baseband System Architecture</span>
          <span>Chapter 33: QXDM Log Packets, NACK Storm Protocol & System Designs</span>
        </div>
        <header class="chapter-opener">
          <div class="chapter-meta-row">
            <span class="chapter-number-pill">Volume III • Chapter 33</span>
            <span class="chapter-phase-pill">Qualcomm QXDM / FAPI P7 / Multi-Core DSP</span>
          </div>
          <h1 class="chapter-title">Chapter 33: Qualcomm QXDM Diagnostic Log Catalog, HARQ NACK Storm Triage & L2 System Designs</h1>
          <p class="chapter-summary">Production baseband post-mortem diagnostics using Qualcomm QXDM log codes (<code>0xB821</code>–<code>0xB890</code>), the 4-step deterministic HARQ NACK storm root-cause isolation tree, and 4 end-to-end L2 MAC C++20 system design blueprints.</p>
        </header>

        <!-- Section 33.1: Qualcomm QXDM Diagnostic Log Catalog -->
        <section class="book-section" id="sec-qxdm-packets" data-outline-id="sec-qxdm-packets" data-outline-label="§ 33.1 Qualcomm QXDM Log Packet Catalog (8 Logs)">
          <div class="section-header-row">
            <div class="section-title-group">
              <div class="section-badge-row">
                <span class="section-number-badge">§ 33.1</span>
                <span class="section-spec-badge">0xB821 – 0xB890</span>
              </div>
              <h2 class="section-title">Qualcomm QXDM 5G NR L1/L2 Diagnostic Log Packet Reference</h2>
            </div>
          </div>

          <div class="table-wrap">
            <table class="spec-table">
              <thead>
                <tr>
                  <th style="width:12%;">Log Code</th>
                  <th style="width:22%;">Packet Name & Layer</th>
                  <th style="width:30%;">Key Fields to Inspect</th>
                  <th style="width:36%;">Diagnostic Description & Triage Usage</th>
                </tr>
              </thead>
              <tbody>
                ${nrDiagnostics
                  .map(
                    (pkt) => `
                      <tr>
                        <td><code class="inline-code inline-code-bold">${FMT.escapeHtml(pkt.logCodeHex || pkt.logCode || "")}</code></td>
                        <td>
                          <strong>${FMT.escapeHtml(pkt.name || pkt.packetName || "")}</strong><br>
                          <span class="section-spec-badge">${FMT.escapeHtml(pkt.layer || "")}</span>
                        </td>
                        <td>
                          ${
                            Array.isArray(pkt.keyFields)
                              ? `<ul class="prose-list" style="margin:0 0 0 14px;">${pkt.keyFields.map((f) => `<li>${FMT.renderInlineMarkdown(f)}</li>`).join("")}</ul>`
                              : FMT.renderInlineMarkdown(pkt.keyFieldsToInspect || "")
                          }
                        </td>
                        <td>
                          <p class="prose-p" style="margin-bottom:0;">${FMT.renderInlineMarkdown(pkt.description || pkt.triageUsage || "")}</p>
                        </td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Section 33.2: 4-Step HARQ NACK Storm Decision Tree -->
        <section class="book-section" id="sec-nack-storm" data-outline-id="sec-nack-storm" data-outline-label="§ 33.2 4-Step HARQ NACK Storm Decision Tree">
          <div class="section-header-row">
            <div class="section-title-group">
              <div class="section-badge-row">
                <span class="section-number-badge">§ 33.2</span>
                <span class="section-spec-badge">Production Incident Playbook</span>
              </div>
              <h2 class="section-title">The 4-Step Deterministic Decision Tree for Debugging a 90% PDSCH HARQ NACK Storm</h2>
            </div>
          </div>

          ${nackTree
            .map(
              (s) => `
                <aside class="callout-box callout-analogy">
                  <div class="callout-header">
                    <span class="callout-icon">🔍</span>
                    <span class="callout-title">${FMT.escapeHtml(s.step)} — QXDM Log: ${FMT.escapeHtml(s.logCode)}</span>
                  </div>
                  <div class="callout-body">
                    <p class="prose-p"><strong>Diagnostic Check:</strong> ${FMT.renderInlineMarkdown(s.check)}</p>
                    <p class="prose-p" style="margin-bottom:0;"><strong>Root Cause & Remediation:</strong> ${FMT.renderInlineMarkdown(s.rootCause)}</p>
                  </div>
                </aside>
              `
            )
            .join("")}
        </section>

        <!-- Section 33.3: 4 Telecom L2 System Design Blueprints -->
        ${nrDesigns
          .map(
            (sd, idx) => `
              <section class="book-section" id="sec-sysdesign-${FMT.escapeHtml(sd.id)}" data-outline-id="sec-sysdesign-${FMT.escapeHtml(sd.id)}" data-outline-label="§ 33.${idx + 3} System Design: ${sd.title}">
                <div class="section-header-row">
                  <div class="section-title-group">
                    <div class="section-badge-row">
                      <span class="section-number-badge">§ 33.${idx + 3}</span>
                      <span class="section-spec-badge">⏱ Budget: ${FMT.escapeHtml(sd.latencyConstraint || sd.latencyBudget || "")}</span>
                    </div>
                    <h2 class="section-title">System Design Blueprint ${idx + 1}: ${FMT.escapeHtml(sd.title)}</h2>
                  </div>
                </div>

                ${
                  sd.summary
                    ? `<p class="prose-p">${FMT.renderInlineMarkdown(sd.summary)}</p>`
                    : ""
                }

                <div class="callout-dual-grid">
                  <aside class="callout-box callout-tips">
                    <div class="callout-header">
                      <span class="callout-icon">🏛️</span>
                      <span class="callout-title">Deterministic Pipeline Stages & Budget Breakdown</span>
                    </div>
                    <ul class="callout-list">
                      ${(sd.pipelineStages || sd.coreArchitecture || []).map((item) => `<li>${FMT.renderInlineMarkdown(item)}</li>`).join("")}
                    </ul>
                  </aside>
                  <aside class="callout-box callout-pitfalls">
                    <div class="callout-header">
                      <span class="callout-icon">⚡</span>
                      <span class="callout-title">Memory Geometry, CPU Pinning & Lock-Free Concurrency</span>
                    </div>
                    <div class="callout-body">
                      <p class="prose-p" style="margin-bottom:0;">${FMT.renderInlineMarkdown(sd.memoryAndConcurrency || sd.concurrencyModel || "")}</p>
                    </div>
                  </aside>
                </div>
              </section>
            `
          )
          .join("")}

        ${!isFullBookRender ? renderPager("nr-diagnostics-designs") : ""}
      </article>
    `;
  }

  // =========================================================================
  // Chapter 34: Top 15 High-Yield 5G NR Interview Questions & Model Answers
  // =========================================================================

  function renderTop15Chapter(isFullBookRender = false) {
    return `
      <article class="book-chapter" id="chapter-anchor-nr-top15">
        <div class="chapter-running-header">
          <span>Volume III — High-Yield 5G NR L2 Interview Prep</span>
          <span>Chapter 34: Top 15 High-Yield 5G NR Interview Questions</span>
        </div>
        <header class="chapter-opener">
          <div class="chapter-meta-row">
            <span class="chapter-number-pill">Volume III • Chapter 34</span>
            <span class="chapter-phase-pill">Ericsson / Apple / Nokia / Qualcomm Core 15</span>
          </div>
          <h1 class="chapter-title">Chapter 34: Top 15 High-Yield 5G NR MAC & Carrier Aggregation Interview Questions</h1>
          <p class="chapter-summary">Curated executive-grade model answers with exact 3GPP Release 16/17 clause citations and concrete engineering examples for the 15 most frequently asked 5G NR L2 interview questions.</p>
        </header>

        <section class="book-section" id="sec-top15-list" data-outline-id="sec-top15-list" data-outline-label="§ 34.1 Top 15 Verbatim Interview Q&As">
          ${nrTop15
            .map(
              (item, idx) => `
                <div class="qa-card" id="top15-q-${item.id || item.number || idx + 1}">
                  <div class="qa-question-bar" data-toggle-qa>
                    <div class="qa-q-prefix">
                      <span class="qa-q-badge">${FMT.escapeHtml(item.id || `TOP #${idx + 1}`)}</span>
                      <span class="qa-q-title">${FMT.renderInlineMarkdown(item.question)}</span>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;">
                      <span class="section-spec-badge">📜 ${FMT.escapeHtml(item.specs || item.specRef || "3GPP Rel-17")}</span>
                    </div>
                  </div>
                  <div class="qa-answer-body">
                    ${FMT.renderFormattedContentBlock(item.detailedAnswer || item.modelAnswer || "")}
                  </div>
                </div>
              `
            )
            .join("")}
        </section>

        ${!isFullBookRender ? renderPager("nr-top15") : ""}
      </article>
    `;
  }

  // =========================================================================
  // Chapter 35: Complete 115-Question Telecom MAC & Embedded C++/RTOS Bank
  // =========================================================================

  function renderQBankChapter(isFullBookRender = false) {
    const categories = ["ALL", ...Array.from(new Set(nrQuestions.map((q) => q.category)))];
    const difficulties = ["ALL", ...Array.from(new Set(nrQuestions.map((q) => q.difficultyLevel)))];

    const filtered = isFullBookRender
      ? nrQuestions
      : nrQuestions.filter((q) => {
          if (state.qbankCategory !== "ALL" && q.category !== state.qbankCategory) return false;
          if (state.qbankDifficulty !== "ALL" && q.difficultyLevel !== state.qbankDifficulty) return false;
          if (state.qbankUnmasteredOnly && state.masteredQuestions[q.id]) return false;
          if (state.qbankSearch.trim()) {
            const needle = state.qbankSearch.trim().toLowerCase();
            const hay = `${q.id} ${q.question} ${q.detailedAnswer} ${q.subcategory} ${q.codeOrSpecRef} ${q.targetCompanyRelevance}`.toLowerCase();
            if (!hay.includes(needle)) return false;
          }
          return true;
        });

    const masteredCount = Object.keys(state.masteredQuestions).filter((k) => state.masteredQuestions[k]).length;

    return `
      <article class="book-chapter" id="chapter-anchor-nr-qbank">
        <div class="chapter-running-header">
          <span>Volume III — 115-Question Telecom MAC & RTOS Interview Compendium</span>
          <span>Chapter 35: Complete 115-Question Bank</span>
        </div>
        <header class="chapter-opener">
          <div class="chapter-meta-row">
            <span class="chapter-number-pill">Volume III • Chapter 35</span>
            <span class="chapter-phase-pill">115 Verified Questions & Deep Answers</span>
            <span class="chapter-hours-pill">✓ ${masteredCount} / ${nrQuestions.length} Mastered</span>
          </div>
          <h1 class="chapter-title">Chapter 35: Complete 115-Question 5G NR MAC, Carrier Aggregation & Embedded C++/RTOS Bank</h1>
          <p class="chapter-summary">Exhaustive question bank spanning 5G NR L2 Architecture, 125 µs Downlink Scheduling, HARQ & Link Adaptation, Carrier Aggregation & Treelite ML, Embedded C++20/RTOS, and Behavioral/System Design.</p>
        </header>

        ${
          !isFullBookRender
            ? `
              <div class="filter-bar no-print">
                <div class="filter-top-row">
                  <input type="text" id="qbank-search-input" class="filter-search-input" placeholder="Filter 115 questions by keyword, 3GPP clause, QXDM log, or company (e.g., SLIV, OLLA, Apple, Ericsson, SPSC)..." value="${FMT.escapeHtml(state.qbankSearch)}">
                  <select id="qbank-diff-select" class="topbar-select">
                    ${difficulties
                      .map(
                        (d) =>
                          `<option value="${FMT.escapeHtml(d)}" ${state.qbankDifficulty === d ? "selected" : ""}>Difficulty: ${FMT.escapeHtml(d)}</option>`
                      )
                      .join("")}
                  </select>
                  <button class="btn ${state.qbankUnmasteredOnly ? "btn-primary" : ""}" id="btn-qbank-unmastered">
                    ${state.qbankUnmasteredOnly ? "Showing Unmastered Only" : "Show All (Inc. Mastered)"}
                  </button>
                  <button class="btn btn-accent" id="btn-launch-nr-quiz">⚡ Random 5G Flashcard Quiz</button>
                </div>
                <div class="filter-chips-row">
                  ${categories
                    .map(
                      (cat) => `
                        <button class="filter-chip ${state.qbankCategory === cat ? "active" : ""}" data-qbank-cat="${FMT.escapeHtml(cat)}">
                          ${FMT.escapeHtml(cat)} (${cat === "ALL" ? nrQuestions.length : nrQuestions.filter((q) => q.category === cat).length})
                        </button>
                      `
                    )
                    .join("")}
                </div>
                <div style="font-size:0.78rem;color:var(--text-muted);">
                  Showing <strong>${filtered.length}</strong> of <strong>${nrQuestions.length}</strong> questions.
                </div>
              </div>
            `
            : ""
        }

        <section class="book-section" id="sec-qbank-list" data-outline-id="sec-qbank-list" data-outline-label="§ 35.1 115 Categorized Interview Questions">
          ${filtered
            .map((q) => {
              const isMastered = !!state.masteredQuestions[q.id];
              return `
                <div class="qa-card" id="qbank-${FMT.escapeHtml(q.id)}">
                  <div class="qa-question-bar" data-toggle-qa>
                    <div class="qa-q-prefix">
                      <span class="qa-q-badge">${FMT.escapeHtml(q.id)}</span>
                      <div>
                        <div class="qa-q-title">${FMT.renderInlineMarkdown(q.question)}</div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
                          <span class="section-spec-badge">${FMT.escapeHtml(q.category)} • ${FMT.escapeHtml(q.subcategory)}</span>
                          <span class="section-spec-badge">📜 ${FMT.escapeHtml(q.codeOrSpecRef)}</span>
                          <span class="section-spec-badge">🏢 ${FMT.escapeHtml(q.targetCompanyRelevance)}</span>
                          <span class="section-spec-badge">⚡ ${FMT.escapeHtml(q.difficultyLevel)}</span>
                        </div>
                      </div>
                    </div>
                    <div class="no-print" style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                      <button class="action-chip ${isMastered ? "completed" : ""}" data-toggle-mastered="${FMT.escapeHtml(q.id)}">
                        ${isMastered ? "✓ Mastered" : "○ Mark Mastered"}
                      </button>
                    </div>
                  </div>
                  <div class="qa-answer-body">
                    ${FMT.renderFormattedContentBlock(q.detailedAnswer)}
                  </div>
                </div>
              `;
            })
            .join("")}
        </section>

        ${!isFullBookRender ? renderPager("nr-qbank") : ""}
      </article>
    `;
  }

  // =========================================================================
  // Chapter 36: Senior Engineering Job-Switch Playbook & Verbatim Pitch Guide
  // =========================================================================

  function renderCareerPlaybookChapter(isFullBookRender = false) {
    const narrative = nrExtras.candidateNarrative || {};
    const employers = nrExtras.targetEmployers || [];
    const checklist = nrExtras.actionableChecklist || [];

    return `
      <article class="book-chapter" id="chapter-anchor-career-playbook">
        <div class="chapter-running-header">
          <span>Volume III — Senior Engineering Career Switch Playbook</span>
          <span>Chapter 36: Positioning, Metrics Reconciliation & Employer Strategy</span>
        </div>
        <header class="chapter-opener">
          <div class="chapter-meta-row">
            <span class="chapter-number-pill">Volume III • Chapter 36</span>
            <span class="chapter-phase-pill">Senior L2 Baseband & C++20 Positioning</span>
          </div>
          <h1 class="chapter-title">Chapter 36: Senior Engineering Job-Switch Playbook, Verbatim Pitch & Target Employer Strategy</h1>
          <p class="chapter-summary">${FMT.escapeHtml(narrative.headline || "Strategic positioning guide for Senior 5G NR L2 Baseband & Modern C++ Systems Engineering interviews.")}</p>
        </header>

        <!-- Section 36.1: Candidate Triad Positioning -->
        <section class="book-section" id="sec-career-triad" data-outline-id="sec-career-triad" data-outline-label="§ 36.1 The 3-Pillar Candidate Narrative">
          <div class="section-header-row">
            <div class="section-title-group">
              <div class="section-badge-row">
                <span class="section-number-badge">§ 36.1</span>
                <span class="section-spec-badge">Executive Positioning</span>
              </div>
              <h2 class="section-title">The 3-Pillar Candidate Positioning Triad</h2>
            </div>
          </div>

          ${(narrative.triad || [])
            .map(
              (p, i) => `
                <aside class="callout-box callout-tips">
                  <div class="callout-header">
                    <span class="callout-icon">0${i + 1}</span>
                    <span class="callout-title">${FMT.escapeHtml(p.pillar)}</span>
                  </div>
                  <div class="callout-body">
                    <p class="prose-p" style="margin-bottom:0;">${FMT.renderInlineMarkdown(p.summary)}</p>
                  </div>
                </aside>
              `
            )
            .join("")}
        </section>

        <!-- Section 36.2: Verbatim Pitch & Metrics Reconciliation -->
        <section class="book-section" id="sec-career-pitch" data-outline-id="sec-career-pitch" data-outline-label="§ 36.2 Verbatim Pitch & Metrics Reconciliation">
          <div class="section-header-row">
            <div class="section-title-group">
              <div class="section-badge-row">
                <span class="section-number-badge">§ 36.2</span>
                <span class="section-spec-badge">Critical Interview Defense</span>
              </div>
              <h2 class="section-title">Reconciling the 42%→91% vs. 60%→85% Accuracy Figures & Verbatim 90-Second Pitch</h2>
            </div>
          </div>

          <aside class="callout-box callout-pitfalls">
            <div class="callout-header">
              <span class="callout-icon">🎯</span>
              <span class="callout-title">How to Explain the Two Accuracy Pairs (42%→91% vs. 60%→85%) with Zero Contradiction</span>
            </div>
            <div class="callout-body">
              <p class="prose-p" style="margin-bottom:0;">${FMT.renderInlineMarkdown(narrative.metricsReconciliation || "")}</p>
            </div>
          </aside>

          <aside class="callout-box callout-analogy">
            <div class="callout-header">
              <span class="callout-icon">🎙️</span>
              <span class="callout-title">Verbatim 90-Second Opening Pitch (Memorize Word-for-Word)</span>
            </div>
            <div class="callout-body">
              <p class="prose-p" style="font-size:1.02rem;font-weight:500;margin-bottom:0;">${FMT.renderInlineMarkdown(narrative.verbatimPitch || "")}</p>
            </div>
          </aside>
        </section>

        <!-- Section 36.3: Target Employer Technical Focus Matrix -->
        <section class="book-section" id="sec-career-employers" data-outline-id="sec-career-employers" data-outline-label="§ 36.3 Target Employer Strategy Matrix">
          <div class="section-header-row">
            <div class="section-title-group">
              <div class="section-badge-row">
                <span class="section-number-badge">§ 36.3</span>
                <span class="section-spec-badge">Company-Specific Angles</span>
              </div>
              <h2 class="section-title">Target Employer Technical Focus & Interview Angle Matrix</h2>
            </div>
          </div>

          <div class="table-wrap">
            <table class="spec-table">
              <thead>
                <tr>
                  <th style="width:22%;">Target Employer</th>
                  <th style="width:26%;">Target Role</th>
                  <th style="width:52%;">Core Technical Focus & Interview Strategy</th>
                </tr>
              </thead>
              <tbody>
                ${employers
                  .map(
                    (emp) => `
                      <tr>
                        <td><strong>${FMT.escapeHtml(emp.company)}</strong></td>
                        <td><span class="section-spec-badge">${FMT.escapeHtml(emp.role)}</span></td>
                        <td>${FMT.renderInlineMarkdown(emp.focus)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Section 36.4: 5-Phase Actionable Execution Checklist -->
        <section class="book-section" id="sec-career-checklist" data-outline-id="sec-career-checklist" data-outline-label="§ 36.4 5-Phase Actionable Readiness Checklist">
          <div class="section-header-row">
            <div class="section-title-group">
              <div class="section-badge-row">
                <span class="section-number-badge">§ 36.4</span>
                <span class="section-spec-badge">Interactive Readiness Tracker</span>
              </div>
              <h2 class="section-title">5-Phase Actionable Job-Switch Readiness Checklist</h2>
            </div>
          </div>

          ${checklist
            .map(
              (phaseObj, pIdx) => `
                <div style="margin-bottom:18px;">
                  <h4 class="prose-subhead">${FMT.escapeHtml(phaseObj.phase)}</h4>
                  <div style="display:flex;flex-direction:column;gap:8px;">
                    ${(phaseObj.items || [])
                      .map((itemText, iIdx) => {
                        const key = `chk_${pIdx}_${iIdx}`;
                        const checked = !!state.checklist[key];
                        return `
                          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:6px;cursor:pointer;">
                            <input type="checkbox" data-checklist-key="${key}" ${checked ? "checked" : ""} style="margin-top:4px;accent-color:var(--accent-primary);">
                            <span style="font-size:0.9rem;color:var(--text-primary);${checked ? "text-decoration:line-through;opacity:0.7;" : ""}">${FMT.renderInlineMarkdown(itemText)}</span>
                          </label>
                        `;
                      })
                      .join("")}
                  </div>
                </div>
              `
            )
            .join("")}
        </section>

        ${!isFullBookRender ? renderPager("career-playbook") : ""}
      </article>
    `;
  }

  // =========================================================================
  // Overview & Executive Study Command Center View
  // =========================================================================

  function renderOverviewDashboard() {
    const prog = computeOverallProgress();

    return `
      <div id="overview-dashboard">
        <article class="book-chapter" style="margin-bottom:24px;">
          <header class="chapter-opener" style="margin-bottom:20px;">
            <div class="chapter-meta-row">
              <span class="chapter-number-pill">OFFICIAL COMPENDIUM & INTERACTIVE WORKBENCH</span>
              <span class="chapter-phase-pill">C++17/20/23 • FAANG DSA • 3GPP 5G NR Rel-17 MAC & CA</span>
              <span class="chapter-hours-pill">🖨️ Print-Ready Hardcover Typesetting</span>
            </div>
            <h1 class="chapter-title">Modern C++23 Systems & 3GPP 5G NR L2 Baseband Engineering Handbook</h1>
            <p class="chapter-summary">
              Complete, zero-omission study and reference compendium synthesized from <strong>Ubiverse</strong>. Designed both as an interactive daily mastery workbench and an authoritative, print-ready technical book (<code>Ctrl+P</code> / Save as PDF) tailored for your senior engineering job switch.
            </p>
          </header>

          <!-- KPI Cards -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Volume I: Modern C++ & DSA</div>
              <div class="kpi-value">21 Days / 92 §</div>
              <div class="kpi-sub">114 Hours • 93 Code Listings • 194 Q&As • 888 MCQs (${prog.doneCpp}/${totalCppSubtopics} Done)</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Volume II: 3GPP 5G NR MAC & CA</div>
              <div class="kpi-value">10 Weeks / 40 §</div>
              <div class="kpi-sub">TS 38.211–38.331 • 125µs Scheduler • HARQ • Treelite ML (${prog.doneNr}/${totalNrTopics} Done)</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Volume III: Telecom & RTOS Q&A Bank</div>
              <div class="kpi-value">115 Q&As + Top 15</div>
              <div class="kpi-sub">8 QXDM Logs • 4 L2 System Designs • 4 Math Drills (${prog.doneQ}/${totalNrQuestions} Mastered)</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Official Printable Book Engine</div>
              <div class="kpi-value">36 Chapters</div>
              <div class="kpi-sub">Hardcover Cover Page, Colophon, Dotted TOC, Part Dividers & All Solutions Expanded</div>
            </div>
          </div>

          <!-- Quick Action Banner for Printing & Book Mode -->
          <div style="background:var(--accent-primary-soft);border:1px solid var(--accent-primary);border-left:5px solid var(--accent-primary);border-radius:8px;padding:18px 22px;margin-bottom:26px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px;">
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent-primary);margin-bottom:4px;">
                🖨️ Ready to Print or Export as an Official Technical Book PDF
              </div>
              <div style="font-size:0.86rem;color:var(--text-secondary);">
                Click <strong>"Print / Save Official Book PDF"</strong> to generate the full hardcover-formatted edition with Cover Sheet, Colophon, Dotted-Leader Table of Contents, Part Dividers, light-paper syntax-highlighted code, and all 309+ interview answers expanded.
              </div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="btn" id="dash-btn-book-preview">📖 Toggle Book Preview Mode</button>
              <button class="btn btn-primary" id="dash-btn-open-print">🖨️ Print / Save Official Book PDF</button>
              <button class="btn btn-accent" id="dash-btn-open-quiz">⚡ Launch Mock Interview Quiz</button>
            </div>
          </div>

          <!-- Quick Jump Curriculum Grid -->
          <h3 class="prose-subhead" style="margin-top:0;">Volume II & III — 5G NR MAC Downlink, Carrier Aggregation & Job-Switch Modules</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;margin-bottom:28px;">
            ${nrWeeks
              .map(
                (w) => `
                  <div class="lab-card" style="cursor:pointer;" data-jump-view="nr-week-${w.week}">
                    <div class="lab-card-header" style="padding:12px 14px;">
                      <div style="font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:var(--accent-primary);">CHAPTER ${21 + w.week} • 5G NR WEEK ${w.week}</div>
                      <div class="lab-card-title" style="font-size:0.92rem;">${FMT.escapeHtml(w.title)}</div>
                      <div class="lab-card-sub">${(w.topics || []).length} Spec Clauses • ${FMT.escapeHtml(w.phase || "")}</div>
                    </div>
                  </div>
                `
              )
              .join("")}
            <div class="lab-card" style="cursor:pointer;border-color:var(--accent-primary);" data-jump-view="nr-protocol-lab">
              <div class="lab-card-header" style="padding:12px 14px;background:var(--accent-primary-soft);">
                <div style="font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:var(--accent-primary);">CHAPTER 32 • INTERACTIVE LAB</div>
                <div class="lab-card-title" style="font-size:0.92rem;">SLIV & OLLA Calculators + 4 Math Drills + 4G/5G Matrix</div>
                <div class="lab-card-sub">TS 38.214 Interactive Slot Visualizer & Formulas</div>
              </div>
            </div>
            <div class="lab-card" style="cursor:pointer;border-color:var(--accent-primary);" data-jump-view="nr-diagnostics-designs">
              <div class="lab-card-header" style="padding:12px 14px;background:var(--accent-primary-soft);">
                <div style="font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:var(--accent-primary);">CHAPTER 33 • DIAGNOSTICS & ARCH</div>
                <div class="lab-card-title" style="font-size:0.92rem;">8 QXDM Log Packets + NACK Storm Tree + 4 L2 System Designs</div>
                <div class="lab-card-sub">0xB821–0xB890 Triage & Lock-Free C++20 Blueprints</div>
              </div>
            </div>
            <div class="lab-card" style="cursor:pointer;border-color:var(--accent-secondary);" data-jump-view="nr-qbank">
              <div class="lab-card-header" style="padding:12px 14px;">
                <div style="font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:var(--accent-secondary);">CHAPTER 35 • COMPLETE QUESTION BANK</div>
                <div class="lab-card-title" style="font-size:0.92rem;">115 Telecom MAC, CA & Embedded C++/RTOS Q&As</div>
                <div class="lab-card-sub">Filter by Category, Difficulty, Company & Spec Clause</div>
              </div>
            </div>
            <div class="lab-card" style="cursor:pointer;border-color:var(--success);" data-jump-view="career-playbook">
              <div class="lab-card-header" style="padding:12px 14px;">
                <div style="font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:var(--success);">CHAPTER 36 • CAREER SWITCH PLAYBOOK</div>
                <div class="lab-card-title" style="font-size:0.92rem;">Triad Narrative, 42%→91% Pitch & Target Employers</div>
                <div class="lab-card-sub">Ericsson, Apple Munich, Nokia AirScale & R&S Strategy</div>
              </div>
            </div>
          </div>

          <h3 class="prose-subhead">Volume I — 21-Day Modern C++17/20/23, FAANG DSA & Systems Curriculum</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;">
            ${cppDays
              .map(
                (d) => `
                  <div class="lab-card" style="cursor:pointer;" data-jump-view="cpp-day-${d.day}">
                    <div class="lab-card-header" style="padding:12px 14px;">
                      <div style="font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:var(--accent-primary);">CHAPTER ${d.day} • C++ DAY ${d.day} (${d.estimated_hours}h)</div>
                      <div class="lab-card-title" style="font-size:0.92rem;">${FMT.escapeHtml(getDayTitle(d))}</div>
                      <div class="lab-card-sub">${(d.subtopics || []).length} Sections • ${getDayMcqs(d).length} MCQs</div>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      </div>
    `;
  }

  // =========================================================================
  // Official Hardcover Book Front-Matter & Full Book Builder (For Print & Book Mode)
  // =========================================================================

  function renderBookFrontMatter(scope) {
    const scopeLabel =
      scope === "vol1"
        ? "VOLUME I EDITION — MODERN C++17/20/23, FAANG DSA & SYSTEMS ARCHITECTURE"
        : scope === "vol2"
        ? "VOLUME II & III EDITION — 3GPP 5G NR L2 MAC, CARRIER AGGREGATION & 115 Q&A BANK"
        : scope === "current"
        ? "SELECTED CHAPTER OFFPRINT EDITION"
        : "COMPLETE UNABRIDGED THREE-VOLUME OMNIBUS EDITION (CHAPTERS 1–36)";

    const includeVol1 = scope === "all" || scope === "vol1";
    const includeVol2 = scope === "all" || scope === "vol2";

    return `
      <!-- 1. OFFICIAL HARDCOVER TITLE PAGE -->
      <div class="book-frontmatter book-cover-sheet">
        <div>
          <div class="cover-top-bar">
            <span>UBIVERSE ENGINEERING PRESS • SENIOR SYSTEMS & TELECOM SERIES</span>
            <span>3GPP REL-16/17/18 • ISO/IEC 14882:2023 (C++23)</span>
          </div>

          <div class="cover-hero">
            <div class="cover-edition-pill">${FMT.escapeHtml(scopeLabel)}</div>
            <h1 class="cover-main-title">
              Modern C++23 Systems Architecture &amp; 3GPP 5G NR Layer-2 Baseband Engineering
            </h1>
            <p class="cover-subtitle">
              A Definitive Technical Compendium on Deterministic Low-Latency C++17/20/23, Lock-Free Multi-Core Concurrency, FAANG Data Structures &amp; System Design, 125 µs 5G NR Downlink MAC Scheduling, HARQ Link Adaptation, and ML-Driven Carrier Aggregation
            </p>
            <div class="cover-rule-accent"></div>

            <div class="cover-volumes-grid">
              <div class="cover-vol-box">
                <div class="cover-vol-box-num">VOLUME I • CHAPTERS 1–21 (114 HOURS)</div>
                <div class="cover-vol-box-title">Modern C++17/20/23, Low-Latency Memory Model, Lock-Free Concurrency &amp; FAANG DSA</div>
                <div class="cover-vol-box-desc">92 Normative Sections • 93 Allman-Formatted Code Listings • 194 Senior Interview Q&amp;As • 888 Verification MCQs • 283 Undefined Behavior &amp; Compiler Traps</div>
              </div>
              <div class="cover-vol-box">
                <div class="cover-vol-box-num">VOLUME II • CHAPTERS 22–31 (10 WEEKS / 40 CLAUSES)</div>
                <div class="cover-vol-box-title">3GPP 5G NR L2 MAC Downlink, 125 µs Slot Scheduling, HARQ &amp; Carrier Aggregation</div>
                <div class="cover-vol-box-desc">TS 38.211 / 38.212 / 38.213 / 38.214 / 38.321 / 38.331 Deep Dives • SLIV &amp; RIV Allocation • OLLA Equilibrium • 16-Process Async HARQ • Treelite ML SCell Prediction</div>
              </div>
              <div class="cover-vol-box">
                <div class="cover-vol-box-num">VOLUME III • CHAPTERS 32–36 (FIELD DIAGNOSTICS &amp; INTERVIEW COMPENDIUM)</div>
                <div class="cover-vol-box-title">QXDM Baseband Post-Mortem Diagnostics, L2 System Designs &amp; 115-Question Bank</div>
                <div class="cover-vol-box-desc">8 Qualcomm QXDM Log Packets (0xB821–0xB890) • 4-Step HARQ NACK Storm Protocol • 4 L2 System Design Blueprints • 115 Categorized Q&amp;As • Senior Career Switch Playbook</div>
              </div>
            </div>
          </div>
        </div>

        <div class="cover-footer">
          <div>
            <div class="cover-author-name">Prepared for Akhzar Farhan</div>
            <div class="cover-author-affil">Samsung R&amp;D Institute Bangalore (5G NR MAC DL &amp; CA) • M.Tech IISc Bangalore (6G O-RAN)</div>
          </div>
          <div class="cover-imprint">
            <div>EDITION: 2026.10 RELEASE</div>
            <div>STANDARDS: 3GPP REL-17 &amp; C++23</div>
          </div>
        </div>
      </div>

      <!-- 2. COLOPHON & NORMATIVE SPECIFICATION CATALOG -->
      <div class="book-frontmatter book-colophon-sheet">
        <h2 class="colophon-title">Normative Standards Catalog &amp; Publication Colophon</h2>
        <p class="prose-p">
          This technical reference manual consolidates the complete C++17/20/23 and 3GPP 5G NR Layer-2 curriculum from the <strong>Ubiverse</strong> engineering repository into a single self-contained textbook formatted for A4 archival printing and rapid pre-interview review.
        </p>

        <div class="table-wrap" style="margin:14px 0;">
          <table class="spec-table">
            <thead>
              <tr>
                <th style="width:22%;">Specification / Standard</th>
                <th style="width:30%;">Official Title</th>
                <th style="width:48%;">Key Clauses &amp; Engineering Mechanisms Covered</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>ISO/IEC 14882:2020 / 2023</strong></td>
                <td>Programming Languages — C++20 &amp; C++23</td>
                <td>RAII, Move Semantics, <code>constexpr</code>/<code>consteval</code>, Concepts, Coroutines, <code>std::jthread</code>, <code>std::atomic</code> Memory Ordering, <code>std::expected</code>, <code>std::mdspan</code>, Lock-Free Ring Buffers</td>
              </tr>
              <tr>
                <td><strong>3GPP TS 38.211</strong></td>
                <td>NR; Physical Channels and Modulation</td>
                <td>§4.2 Scalable Numerology ($\mu \in [0,4]$), §4.3.2 OFDM Slot &amp; Frame Structure, CORESET &amp; REG-to-CCE Interleaving</td>
              </tr>
              <tr>
                <td><strong>3GPP TS 38.212</strong></td>
                <td>NR; Multiplexing and Channel Coding</td>
                <td>§5.4.2 LDPC Circular Buffer Rate Matching, Redundancy Versions ($RV \in \{0,2,3,1\}$), §7.3.1 DCI Formats 1_0, 1_1, 1_2, CIF</td>
              </tr>
              <tr>
                <td><strong>3GPP TS 38.213</strong></td>
                <td>NR; Physical Layer Procedures for Control</td>
                <td>§9.1 Type-1/2/3 HARQ-ACK Codebooks, DAI Counter/Total, $K_1$ Timing, §10 PDCCH Blind Decoding &amp; Search Spaces</td>
              </tr>
              <tr>
                <td><strong>3GPP TS 38.214</strong></td>
                <td>NR; Physical Layer Procedures for Data</td>
                <td>§5.1.2.1 Resource Allocation Type 0 (RBG Bitmap) &amp; Type 1 (RIV), Time-Domain SLIV ($K_0, S, L$), §5.1.3 MCS Tables 1–3 &amp; TBS Determination, §5.2 CSI Reporting &amp; OLLA</td>
              </tr>
              <tr>
                <td><strong>3GPP TS 38.321</strong></td>
                <td>NR; Medium Access Control (MAC) Protocol</td>
                <td>§5.2 Multiplexing &amp; Assembly, §5.4.2 16-Process Async DL HARQ Entity, §5.9 SCell Activation/Deactivation MAC CE (<code>LCID=58/57</code>) &amp; <code>sCellDeactivationTimer</code>, §6.1.2 MAC PDU Subheaders</td>
              </tr>
              <tr>
                <td><strong>3GPP TS 38.331 &amp; 38.133</strong></td>
                <td>NR; RRC Protocol &amp; RRM Requirements</td>
                <td><code>ServingCellConfig</code>, Measurement Events A1–A6, Warm vs. Cold SCell Activation Delay Budgets</td>
              </tr>
              <tr>
                <td><strong>Small Cell Forum FAPI</strong></td>
                <td>5G nFAPI / FAPI PHY-MAC Interface</td>
                <td>P5 (PHY Config) &amp; P7 (Slot Tick: <code>SLOT.indication</code>, <code>DL_TTI.request</code>, <code>TX_Data.request</code>, <code>CRC.indication</code>, <code>UCI.indication</code>)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <aside class="callout-box callout-tips">
          <div class="callout-header">
            <span class="callout-icon">📌</span>
            <span class="callout-title">How to Use This Printed Compendium</span>
          </div>
          <ul class="callout-list">
            <li><strong>All Answers Expanded in Print:</strong> Every interview question, calculation drill, and verification explanation is automatically expanded in print mode so nothing is hidden on paper or PDF.</li>
            <li><strong>Zero Code Clipping:</strong> All C++20/23 and 5G NR baseband listings use high-contrast light-paper syntax highlighting with automatic line wrapping (<code>pre-wrap</code>).</li>
            <li><strong>Clause-First Citations:</strong> Begin every senior interview response by anchoring on the governing 3GPP clause or C++ standard rule listed in each section badge.</li>
          </ul>
        </aside>
      </div>

      <!-- 3. FORMAL DOTTED-LEADER TABLE OF CONTENTS -->
      <div class="book-frontmatter book-toc-sheet">
        <div class="toc-main-header">
          <div style="font-family:var(--font-mono);font-size:0.75rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#1e40af;">CONTENTS OVERVIEW</div>
          <h2 class="toc-main-title">Table of Contents</h2>
        </div>

        ${
          includeVol1
            ? `
              <div class="toc-part-block">
                <div class="toc-part-heading">Volume I — Modern C++17/20/23, Low-Latency Systems &amp; FAANG DSA (Chapters 1–21)</div>
                ${cppDays
                  .map(
                    (d) => `
                      <div class="toc-entry-row">
                        <span class="toc-entry-code">Chapter ${d.day}</span>
                        <span class="toc-entry-title">Day ${d.day}: ${FMT.escapeHtml(getDayTitle(d))}</span>
                        <span class="toc-entry-dots"></span>
                        <span class="toc-entry-meta">${(d.subtopics || []).length} § • ${getDayMcqs(d).length} MCQs • ${d.estimated_hours}h</span>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
            : ""
        }

        ${
          includeVol2
            ? `
              <div class="toc-part-block">
                <div class="toc-part-heading">Volume II — 3GPP 5G NR L2 MAC Downlink &amp; Carrier Aggregation (Chapters 22–31)</div>
                ${nrWeeks
                  .map(
                    (w) => `
                      <div class="toc-entry-row">
                        <span class="toc-entry-code">Chapter ${21 + w.week}</span>
                        <span class="toc-entry-title">NR Week ${w.week}: ${FMT.escapeHtml(w.title)}</span>
                        <span class="toc-entry-dots"></span>
                        <span class="toc-entry-meta">${(w.topics || []).length} Spec Clauses • ${FMT.escapeHtml(w.phase || "")}</span>
                      </div>
                    `
                  )
                  .join("")}
              </div>

              <div class="toc-part-block">
                <div class="toc-part-heading">Volume III — Protocol Math Lab, QXDM Diagnostics, 115-Question Bank &amp; Career Playbook (Chapters 32–36)</div>
                <div class="toc-entry-row">
                  <span class="toc-entry-code">Chapter 32</span>
                  <span class="toc-entry-title">3GPP Protocol Lab (SLIV &amp; OLLA), 8 Core Formulas, 4 Math Drills &amp; 4G/5G Matrix</span>
                  <span class="toc-entry-dots"></span>
                  <span class="toc-entry-meta">TS 38.214</span>
                </div>
                <div class="toc-entry-row">
                  <span class="toc-entry-code">Chapter 33</span>
                  <span class="toc-entry-title">Qualcomm QXDM Log Packet Catalog (0xB821–0xB890), NACK Storm Tree &amp; 4 L2 System Designs</span>
                  <span class="toc-entry-dots"></span>
                  <span class="toc-entry-meta">L1/L2 Triage</span>
                </div>
                <div class="toc-entry-row">
                  <span class="toc-entry-code">Chapter 34</span>
                  <span class="toc-entry-title">Top 15 High-Yield 5G NR L2 Interview Questions &amp; Verbatim Model Answers</span>
                  <span class="toc-entry-dots"></span>
                  <span class="toc-entry-meta">15 Core Q&amp;As</span>
                </div>
                <div class="toc-entry-row">
                  <span class="toc-entry-code">Chapter 35</span>
                  <span class="toc-entry-title">Complete 115-Question Telecom MAC, Carrier Aggregation &amp; Embedded C++/RTOS Bank</span>
                  <span class="toc-entry-dots"></span>
                  <span class="toc-entry-meta">115 Q&amp;As</span>
                </div>
                <div class="toc-entry-row">
                  <span class="toc-entry-code">Chapter 36</span>
                  <span class="toc-entry-title">Senior Engineering Job-Switch Playbook, 42%→91% Pitch &amp; Target Employer Matrix</span>
                  <span class="toc-entry-dots"></span>
                  <span class="toc-entry-meta">Career Guide</span>
                </div>
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  function renderPartDividerSheet(partRoman, title, subtitle) {
    return `
      <div class="book-part-sheet">
        <div class="part-divider-box">
          <div class="part-numeral">${FMT.escapeHtml(partRoman)}</div>
          <h2 class="part-heading-title">${FMT.escapeHtml(title)}</h2>
          <p class="part-heading-desc">${FMT.escapeHtml(subtitle)}</p>
        </div>
      </div>
    `;
  }

  function renderFullBookEdition(scope) {
    let html = renderBookFrontMatter(scope);

    if (scope === "current") {
      html += renderSingleActiveView(true);
      return html;
    }

    if (scope === "all" || scope === "vol1") {
      html += renderPartDividerSheet(
        "VOLUME I • CHAPTERS 1–21",
        "Modern C++17/20/23, Low-Latency Systems Architecture & FAANG DSA",
        "Complete 21-Day (114-Hour) Mastery Curriculum covering Memory Layout, Pointers, RAII, Move Semantics, Polymorphism, Vtables, Templates, STL Internals, Lock-Free Concurrency, Design Patterns, Profiling, FAANG Data Structures & System Design."
      );
      for (const dayObj of cppDays) {
        html += renderCppDayChapter(dayObj, true);
      }
    }

    if (scope === "all" || scope === "vol2") {
      html += renderPartDividerSheet(
        "VOLUME II • CHAPTERS 22–31",
        "3GPP 5G NR Layer-2 MAC Downlink, 125 µs Slot Scheduling & Carrier Aggregation",
        "Complete 10-Week (40-Clause) Specification Deep-Dive across 3GPP TS 38.211, 38.212, 38.213, 38.214, 38.321, and 38.331: Numerology, FAPI P7 Slot Pipeline, Proportional Fair, SLIV/RIV, MCS/TBS, OLLA, 16-Process Async HARQ, SCell Activation FSM, and Treelite ML Offloading."
      );
      for (const weekObj of nrWeeks) {
        html += renderNrWeekChapter(weekObj, true);
      }

      html += renderPartDividerSheet(
        "VOLUME III • CHAPTERS 32–36",
        "3GPP Protocol Math Lab, Qualcomm QXDM Diagnostics, L2 System Designs & 115-Question Bank",
        "Interactive & Reference Calculators, 8 QXDM Log Packets (0xB821–0xB890), 4-Step HARQ NACK Storm Triage Protocol, 4 Lock-Free C++20 Baseband System Designs, Top 15 High-Yield Q&As, All 115 Categorized Interview Q&As, and the Senior Career Switch Playbook."
      );
      html += renderProtocolLabChapter(true);
      html += renderDiagnosticsAndDesignsChapter(true);
      html += renderTop15Chapter(true);
      html += renderQBankChapter(true);
      html += renderCareerPlaybookChapter(true);
    }

    return html;
  }

  // =========================================================================
  // Main Canvas Dispatcher & Event Wiring
  // =========================================================================

  function renderSingleActiveView(isForPrint = false) {
    const v = state.currentView;
    if (v === "overview") {
      return isForPrint ? renderCareerPlaybookChapter(true) : renderOverviewDashboard();
    }
    if (v.startsWith("cpp-day-")) {
      const dayNum = Number(v.replace("cpp-day-", ""));
      const dayObj = cppDays.find((d) => d.day === dayNum) || cppDays[0];
      return renderCppDayChapter(dayObj, isForPrint);
    }
    if (v.startsWith("nr-week-")) {
      const weekNum = Number(v.replace("nr-week-", ""));
      const weekObj = nrWeeks.find((w) => w.week === weekNum) || nrWeeks[0];
      return renderNrWeekChapter(weekObj, isForPrint);
    }
    if (v === "nr-protocol-lab") return renderProtocolLabChapter(isForPrint);
    if (v === "nr-diagnostics-designs") return renderDiagnosticsAndDesignsChapter(isForPrint);
    if (v === "nr-top15") return renderTop15Chapter(isForPrint);
    if (v === "nr-qbank") return renderQBankChapter(isForPrint);
    if (v === "career-playbook") return renderCareerPlaybookChapter(isForPrint);
    return renderOverviewDashboard();
  }

  function renderMainContent() {
    const mainEl = document.getElementById("main-canvas");
    if (!mainEl) return;

    if (state.bookPreviewMode) {
      mainEl.innerHTML = renderFullBookEdition(state.printScope);
    } else {
      mainEl.innerHTML = renderSingleActiveView(false);
    }

    bindMainCanvasEvents();
    renderPageOutline();
  }

  function bindMainCanvasEvents() {
    const mainEl = document.getElementById("main-canvas");
    if (!mainEl) return;

    // 1. Pager navigation
    mainEl.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        navigateTo(btn.getAttribute("data-nav"));
      });
    });

    // 2. Dashboard quick-jump cards
    mainEl.querySelectorAll("[data-jump-view]").forEach((card) => {
      card.addEventListener("click", () => {
        navigateTo(card.getAttribute("data-jump-view"));
      });
    });

    // 3. Dashboard quick action buttons
    const dashBookBtn = document.getElementById("dash-btn-book-preview");
    if (dashBookBtn) {
      dashBookBtn.addEventListener("click", () => {
        state.bookPreviewMode = !state.bookPreviewMode;
        saveState();
        applyPreferencesToDOM();
        renderMainContent();
      });
    }
    const dashPrintBtn = document.getElementById("dash-btn-open-print");
    if (dashPrintBtn) {
      dashPrintBtn.addEventListener("click", () => openPrintModal());
    }
    const dashQuizBtn = document.getElementById("dash-btn-open-quiz");
    if (dashQuizBtn) {
      dashQuizBtn.addEventListener("click", () => openQuizModal("cpp", "all"));
    }

    // 4. Toggle C++ Subtopic Completed
    mainEl.querySelectorAll("[data-toggle-cpp]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-toggle-cpp");
        state.completedCppSubtopics[id] = !state.completedCppSubtopics[id];
        saveState();
        updateTopbarProgress();
        renderSidebar();
        renderMainContent();
      });
    });

    // 5. Toggle 5G NR Topic Completed
    mainEl.querySelectorAll("[data-toggle-nr]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-toggle-nr");
        state.completedNrTopics[id] = !state.completedNrTopics[id];
        saveState();
        updateTopbarProgress();
        renderSidebar();
        renderMainContent();
      });
    });

    // 6. Toggle Bookmark
    mainEl.querySelectorAll("[data-toggle-bookmark]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-toggle-bookmark");
        state.bookmarks[id] = !state.bookmarks[id];
        saveState();
        renderMainContent();
      });
    });

    // 7. Toggle Mastered Question in 115 Bank
    mainEl.querySelectorAll("[data-toggle-mastered]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-toggle-mastered");
        state.masteredQuestions[id] = !state.masteredQuestions[id];
        saveState();
        updateTopbarProgress();
        renderSidebar();
        renderMainContent();
      });
    });

    // 8. Copy Code Buttons
    mainEl.querySelectorAll("[data-copy-code]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = decodeURIComponent(btn.getAttribute("data-copy-code"));
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(raw).then(() => {
            const orig = btn.textContent;
            btn.textContent = "✓ Copied!";
            setTimeout(() => {
              btn.textContent = orig;
            }, 1400);
          });
        }
      });
    });

    // 9. Active Recall Q&A Card Reveal
    mainEl.querySelectorAll("[data-toggle-qa]").forEach((bar) => {
      bar.addEventListener("click", () => {
        const card = bar.closest(".qa-card");
        if (card) card.classList.toggle("revealed");
      });
    });

    // 10. Interactive MCQ option selection
    mainEl.querySelectorAll(".mcq-card").forEach((card) => {
      const correctIdx = Number(card.getAttribute("data-mcq-correct"));
      card.querySelectorAll(".mcq-opt").forEach((opt) => {
        opt.addEventListener("click", () => {
          const chosenIdx = Number(opt.getAttribute("data-mcq-opt"));
          card.classList.add("revealed");
          card.querySelectorAll(".mcq-opt").forEach((o) => {
            o.classList.remove("selected-correct", "selected-wrong");
          });
          if (chosenIdx === correctIdx) {
            opt.classList.add("selected-correct");
          } else {
            opt.classList.add("selected-wrong");
            const rightEl = card.querySelector(`.mcq-opt[data-mcq-opt="${correctIdx}"]`);
            if (rightEl) rightEl.classList.add("selected-correct");
          }
        });
      });
    });

    // 11. Launch Day-specific MCQ Quiz
    mainEl.querySelectorAll("[data-launch-day-quiz]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dayNum = Number(btn.getAttribute("data-launch-day-quiz"));
        openQuizModal("cpp", dayNum);
      });
    });

    // 12. Interactive SLIV & OLLA Calculators
    const slivSInput = document.getElementById("input-sliv-s");
    const slivLInput = document.getElementById("input-sliv-l");
    const slivDecInput = document.getElementById("input-sliv-decode");
    if (slivSInput && slivLInput) {
      const onSlivChange = () => {
        state.slivS = Number(slivSInput.value);
        state.slivL = Number(slivLInput.value);
        saveState();
        renderMainContent();
      };
      slivSInput.addEventListener("input", onSlivChange);
      slivLInput.addEventListener("input", onSlivChange);
    }
    if (slivDecInput) {
      slivDecInput.addEventListener("input", () => {
        state.slivDecodeInput = Number(slivDecInput.value);
        saveState();
        const dec = FMT.decodeSliv(state.slivDecodeInput);
        const lbl = document.getElementById("label-sliv-decode");
        if (lbl) {
          lbl.textContent = dec && dec.valid ? `S=${dec.S}, L=${dec.L}` : "Invalid";
        }
      });
    }

    const ollaBlerInput = document.getElementById("input-olla-bler");
    const ollaUpInput = document.getElementById("input-olla-up");
    if (ollaBlerInput && ollaUpInput) {
      const onOllaChange = () => {
        state.ollaBler = Number(ollaBlerInput.value);
        state.ollaUp = Number(ollaUpInput.value);
        saveState();
        renderMainContent();
      };
      ollaBlerInput.addEventListener("input", onOllaChange);
      ollaUpInput.addEventListener("input", onOllaChange);
    }

    // 13. 115-Question Bank Filters
    const qSearch = document.getElementById("qbank-search-input");
    if (qSearch) {
      qSearch.addEventListener("input", () => {
        state.qbankSearch = qSearch.value;
        const pos = qSearch.selectionStart;
        saveState();
        renderMainContent();
        const newInput = document.getElementById("qbank-search-input");
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(pos, pos);
        }
      });
    }

    const qDiff = document.getElementById("qbank-diff-select");
    if (qDiff) {
      qDiff.addEventListener("change", () => {
        state.qbankDifficulty = qDiff.value;
        saveState();
        renderMainContent();
      });
    }

    const qUnmastered = document.getElementById("btn-qbank-unmastered");
    if (qUnmastered) {
      qUnmastered.addEventListener("click", () => {
        state.qbankUnmasteredOnly = !state.qbankUnmasteredOnly;
        saveState();
        renderMainContent();
      });
    }

    const btnNrQuiz = document.getElementById("btn-launch-nr-quiz");
    if (btnNrQuiz) {
      btnNrQuiz.addEventListener("click", () => openQuizModal("nr", "all"));
    }

    mainEl.querySelectorAll("[data-qbank-cat]").forEach((chip) => {
      chip.addEventListener("click", () => {
        state.qbankCategory = chip.getAttribute("data-qbank-cat");
        saveState();
        renderMainContent();
      });
    });

    // 14. Career Playbook Checklist
    mainEl.querySelectorAll("[data-checklist-key]").forEach((chk) => {
      chk.addEventListener("change", () => {
        const key = chk.getAttribute("data-checklist-key");
        state.checklist[key] = chk.checked;
        saveState();
        renderMainContent();
      });
    });
  }

  // =========================================================================
  // Global Search Modal (Ctrl+K)
  // =========================================================================

  function buildSearchIndex() {
    const items = [];

    // C++ Subtopics & Q&As
    for (const d of cppDays) {
      const dTitle = getDayTitle(d);
      for (const sub of d.subtopics || []) {
        items.push({
          type: `C++ Day ${d.day}: ${dTitle}`,
          title: `${sub.title}`,
          snippet: (sub.explanation || "").slice(0, 180),
          view: `cpp-day-${d.day}`,
          anchor: `sec-${sub.id}`,
          searchBlob: `${dTitle} ${sub.id} ${sub.title} ${sub.explanation || ""}`.toLowerCase()
        });
      }
    }

    // 5G NR Spec Topics
    for (const w of nrWeeks) {
      for (const t of w.topics || []) {
        items.push({
          type: `5G NR Week ${w.week} (${t.specClause || "3GPP"})`,
          title: `${t.title}`,
          snippet: (t.explanation || "").slice(0, 180),
          view: `nr-week-${w.week}`,
          anchor: `sec-${t.id}`,
          searchBlob: `${w.title} ${t.id} ${t.title} ${t.specClause} ${t.explanation || ""} ${(t.keyFormulas || []).join(" ")}`.toLowerCase()
        });
      }
    }

    // 115 Question Bank
    for (const q of nrQuestions) {
      items.push({
        type: `115 Q&A Bank • ${q.id} (${q.category})`,
        title: q.question,
        snippet: (q.detailedAnswer || "").slice(0, 180),
        view: "nr-qbank",
        anchor: `qbank-${q.id}`,
        searchBlob: `${q.id} ${q.category} ${q.subcategory} ${q.question} ${q.detailedAnswer} ${q.codeOrSpecRef} ${q.targetCompanyRelevance}`.toLowerCase()
      });
    }

    // QXDM Logs
    for (const pkt of nrDiagnostics) {
      const code = pkt.logCodeHex || pkt.logCode || "";
      const name = pkt.name || pkt.packetName || "";
      const desc = pkt.description || pkt.triageUsage || "";
      items.push({
        type: `QXDM Diagnostic (${code})`,
        title: `${code} — ${name}`,
        snippet: desc,
        view: "nr-diagnostics-designs",
        anchor: "sec-qxdm-packets",
        searchBlob: `${code} ${name} ${desc} ${pkt.keyFieldsToInspect || ""}`.toLowerCase()
      });
    }

    return items;
  }

  const SEARCH_INDEX = buildSearchIndex();

  function openSearchModal() {
    const modal = document.getElementById("modal-search");
    const input = document.getElementById("global-search-input");
    if (!modal || !input) return;
    modal.classList.add("open");
    input.value = "";
    renderSearchResults("");
    setTimeout(() => input.focus(), 40);
  }

  function closeSearchModal() {
    const modal = document.getElementById("modal-search");
    if (modal) modal.classList.remove("open");
  }

  function renderSearchResults(query) {
    const listEl = document.getElementById("global-search-results");
    if (!listEl) return;

    const q = query.trim().toLowerCase();
    const matches = q
      ? SEARCH_INDEX.filter((item) => item.searchBlob.includes(q)).slice(0, 35)
      : SEARCH_INDEX.slice(0, 15);

    if (matches.length === 0) {
      listEl.innerHTML = `<div style="padding:20px;color:var(--text-muted);text-align:center;">No matching sections, 3GPP clauses, or questions found for "${FMT.escapeHtml(query)}".</div>`;
      return;
    }

    listEl.innerHTML = matches
      .map(
        (m, idx) => `
          <div class="search-result-item" data-search-idx="${idx}" data-view="${FMT.escapeHtml(m.view)}" data-anchor="${FMT.escapeHtml(m.anchor)}">
            <div class="search-result-meta">${FMT.escapeHtml(m.type)}</div>
            <div class="search-result-title">${FMT.escapeHtml(m.title)}</div>
            <div class="search-result-snippet">${FMT.escapeHtml(m.snippet)}...</div>
          </div>
        `
      )
      .join("");

    listEl.querySelectorAll(".search-result-item").forEach((el) => {
      el.addEventListener("click", () => {
        const view = el.getAttribute("data-view");
        const anchor = el.getAttribute("data-anchor");
        closeSearchModal();
        if (view === "nr-qbank") {
          state.qbankCategory = "ALL";
          state.qbankDifficulty = "ALL";
          state.qbankSearch = "";
          state.qbankUnmasteredOnly = false;
        }
        state.bookPreviewMode = false;
        navigateTo(view, anchor);
      });
    });
  }

  // =========================================================================
  // Print / Save Official Book PDF Modal & Automatic beforeprint Hook
  // =========================================================================

  function openPrintModal() {
    const modal = document.getElementById("modal-print");
    if (!modal) return;
    modal.classList.add("open");

    const scopeRadios = modal.querySelectorAll('input[name="print-scope"]');
    scopeRadios.forEach((r) => {
      r.checked = r.value === state.printScope;
    });

    const mcqCheck = document.getElementById("print-include-mcqs");
    if (mcqCheck) mcqCheck.checked = !!state.includeMcqsInPrint;
  }

  function closePrintModal() {
    const modal = document.getElementById("modal-print");
    if (modal) modal.classList.remove("open");
  }

  function executeOfficialBookPrint() {
    closePrintModal();
    const mainEl = document.getElementById("main-canvas");
    if (!mainEl) return;

    const wasBookPreview = state.bookPreviewMode;
    // Render the chosen full book scope into the canvas
    mainEl.innerHTML = renderFullBookEdition(state.printScope);
    document.body.classList.toggle("exclude-mcqs-in-print", !state.includeMcqsInPrint);

    setTimeout(() => {
      window.print();
      if (!wasBookPreview) {
        renderMainContent();
      }
    }, 180);
  }

  // Ensure pressing Ctrl+P directly in the browser also prints the formatted book!
  window.addEventListener("beforeprint", () => {
    const mainEl = document.getElementById("main-canvas");
    if (mainEl && !state.bookPreviewMode) {
      mainEl.innerHTML = renderFullBookEdition(state.printScope);
    }
  });

  window.addEventListener("afterprint", () => {
    if (!state.bookPreviewMode) {
      renderMainContent();
    }
  });

  // =========================================================================
  // Interactive Mock Exam / Quiz Modal (888 C++ MCQs + 115 5G NR Q&As)
  // =========================================================================

  let quizSession = {
    mode: "cpp", // 'cpp' | 'nr'
    dayFilter: "all",
    pool: [],
    currentIndex: 0,
    score: 0,
    answered: 0,
    selectedOpt: null
  };

  function openQuizModal(mode = "cpp", dayFilter = "all") {
    const modal = document.getElementById("modal-quiz");
    if (!modal) return;
    modal.classList.add("open");
    startQuizSession(mode, dayFilter);
  }

  function closeQuizModal() {
    const modal = document.getElementById("modal-quiz");
    if (modal) modal.classList.remove("open");
  }

  function startQuizSession(mode, dayFilter) {
    quizSession.mode = mode;
    quizSession.dayFilter = dayFilter;
    quizSession.currentIndex = 0;
    quizSession.score = 0;
    quizSession.answered = 0;
    quizSession.selectedOpt = null;

    if (mode === "cpp") {
      let allMcqs = [];
      for (const d of cppDays) {
        if (dayFilter === "all" || Number(dayFilter) === d.day) {
          for (const m of getDayMcqs(d)) {
            allMcqs.push({ ...m, day: d.day, dayTitle: getDayTitle(d) });
          }
        }
      }
      // Shuffle
      quizSession.pool = allMcqs.sort(() => Math.random() - 0.5).slice(0, 25);
    } else {
      quizSession.pool = [...nrQuestions].sort(() => Math.random() - 0.5).slice(0, 25);
    }

    renderQuizModalBody();
  }

  function renderQuizModalBody() {
    const bodyEl = document.getElementById("quiz-modal-body");
    if (!bodyEl) return;

    const total = quizSession.pool.length;
    if (total === 0) {
      bodyEl.innerHTML = `<p>No questions available for this filter.</p>`;
      return;
    }

    const item = quizSession.pool[quizSession.currentIndex];
    const letters = ["A", "B", "C", "D", "E"];

    let controlsBar = `
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);">
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn ${quizSession.mode === "cpp" ? "btn-primary" : ""}" id="quiz-switch-cpp">C++ 888 MCQ Exam</button>
          <button class="btn ${quizSession.mode === "nr" ? "btn-primary" : ""}" id="quiz-switch-nr">5G NR 115 Q&A Drill</button>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.82rem;font-weight:700;color:var(--accent-primary);">
          Question ${quizSession.currentIndex + 1} / ${total} • Score: ${quizSession.score} / ${quizSession.answered}
        </div>
      </div>
    `;

    if (quizSession.mode === "cpp") {
      const correctIdx =
        item.correct_option !== undefined ? Number(item.correct_option) : Number(item.correct_answer);
      const isAnswered = quizSession.selectedOpt !== null;

      bodyEl.innerHTML = `
        ${controlsBar}
        <div style="margin-bottom:10px;">
          <span class="section-spec-badge">Day ${item.day}: ${FMT.escapeHtml(item.dayTitle)}</span>
        </div>
        <div style="font-size:1.05rem;font-weight:700;margin-bottom:16px;line-height:1.5;">
          ${FMT.renderInlineMarkdown(item.question)}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px;">
          ${(item.options || [])
            .map((opt, oIdx) => {
              let cls = "mcq-opt";
              if (isAnswered) {
                if (oIdx === correctIdx) cls += " selected-correct";
                else if (oIdx === quizSession.selectedOpt) cls += " selected-wrong";
              }
              return `
                <div class="${cls}" data-quiz-opt="${oIdx}" style="padding:10px 14px;font-size:0.92rem;">
                  <span class="mcq-opt-letter">${letters[oIdx] || oIdx + 1}.</span>
                  <span>${FMT.renderInlineMarkdown(opt)}</span>
                </div>
              `;
            })
            .join("")}
        </div>
        ${
          isAnswered
            ? `
              <aside class="callout-box callout-tips" style="margin-bottom:16px;">
                <div class="callout-header">
                  <span class="callout-icon">✓</span>
                  <span class="callout-title">Explanation (Correct Answer: ${letters[correctIdx]})</span>
                </div>
                <div class="callout-body">${FMT.renderInlineMarkdown(item.explanation || "")}</div>
              </aside>
            `
            : ""
        }
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <button class="btn" id="quiz-prev-btn" ${quizSession.currentIndex === 0 ? "disabled" : ""}>← Previous</button>
          <button class="btn btn-primary" id="quiz-next-btn">${quizSession.currentIndex < total - 1 ? "Next Question →" : "Restart New Batch ↻"}</button>
        </div>
      `;

      bodyEl.querySelectorAll("[data-quiz-opt]").forEach((optEl) => {
        optEl.addEventListener("click", () => {
          if (quizSession.selectedOpt !== null) return;
          const chosen = Number(optEl.getAttribute("data-quiz-opt"));
          quizSession.selectedOpt = chosen;
          quizSession.answered++;
          if (chosen === correctIdx) quizSession.score++;
          renderQuizModalBody();
        });
      });
    } else {
      const revealed = quizSession.selectedOpt === true;
      bodyEl.innerHTML = `
        ${controlsBar}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <span class="section-spec-badge">${FMT.escapeHtml(item.id)} • ${FMT.escapeHtml(item.category)}</span>
          <span class="section-spec-badge">📜 ${FMT.escapeHtml(item.codeOrSpecRef)}</span>
          <span class="section-spec-badge">🏢 ${FMT.escapeHtml(item.targetCompanyRelevance)}</span>
        </div>
        <div style="font-size:1.05rem;font-weight:700;margin-bottom:16px;line-height:1.5;">
          ${FMT.renderInlineMarkdown(item.question)}
        </div>
        ${
          !revealed
            ? `<button class="btn btn-primary" id="quiz-reveal-nr" style="width:100%;justify-content:center;padding:12px;">👁️ Reveal Verbatim 3GPP & C++ Model Answer</button>`
            : `
              <div style="padding:16px;background:var(--bg-subtle);border:1px solid var(--border-strong);border-radius:8px;margin-bottom:16px;">
                ${FMT.renderFormattedContentBlock(item.detailedAnswer)}
              </div>
              <div style="display:flex;gap:10px;margin-bottom:16px;">
                <button class="btn btn-primary" id="quiz-mark-mastered">✓ I Nailed It (Mark Mastered)</button>
                <button class="btn" id="quiz-mark-review">○ Need More Review</button>
              </div>
            `
        }
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
          <button class="btn" id="quiz-prev-btn" ${quizSession.currentIndex === 0 ? "disabled" : ""}>← Previous</button>
          <button class="btn btn-primary" id="quiz-next-btn">${quizSession.currentIndex < total - 1 ? "Next Question →" : "New Random Batch ↻"}</button>
        </div>
      `;

      const revBtn = document.getElementById("quiz-reveal-nr");
      if (revBtn) {
        revBtn.addEventListener("click", () => {
          quizSession.selectedOpt = true;
          renderQuizModalBody();
        });
      }

      const masterBtn = document.getElementById("quiz-mark-mastered");
      if (masterBtn) {
        masterBtn.addEventListener("click", () => {
          state.masteredQuestions[item.id] = true;
          saveState();
          updateTopbarProgress();
          renderSidebar();
          quizSession.answered++;
          quizSession.score++;
          if (quizSession.currentIndex < total - 1) {
            quizSession.currentIndex++;
            quizSession.selectedOpt = null;
            renderQuizModalBody();
          }
        });
      }

      const revAgainBtn = document.getElementById("quiz-mark-review");
      if (revAgainBtn) {
        revAgainBtn.addEventListener("click", () => {
          quizSession.answered++;
          if (quizSession.currentIndex < total - 1) {
            quizSession.currentIndex++;
            quizSession.selectedOpt = null;
            renderQuizModalBody();
          }
        });
      }
    }

    const switchCpp = document.getElementById("quiz-switch-cpp");
    if (switchCpp) switchCpp.addEventListener("click", () => startQuizSession("cpp", "all"));

    const switchNr = document.getElementById("quiz-switch-nr");
    if (switchNr) switchNr.addEventListener("click", () => startQuizSession("nr", "all"));

    const prevBtn = document.getElementById("quiz-prev-btn");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (quizSession.currentIndex > 0) {
          quizSession.currentIndex--;
          quizSession.selectedOpt = null;
          renderQuizModalBody();
        }
      });
    }

    const nextBtn = document.getElementById("quiz-next-btn");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (quizSession.currentIndex < total - 1) {
          quizSession.currentIndex++;
          quizSession.selectedOpt = null;
          renderQuizModalBody();
        } else {
          startQuizSession(quizSession.mode, quizSession.dayFilter);
        }
      });
    }
  }

  // =========================================================================
  // Topbar & Global Keyboard Shortcuts Initialization
  // =========================================================================

  function initTopbarAndModals() {
    // Brand click -> overview
    const brandEl = document.getElementById("topbar-brand-home");
    if (brandEl) {
      brandEl.addEventListener("click", () => {
        state.bookPreviewMode = false;
        navigateTo("overview");
      });
    }

    // Search trigger
    const btnSearch = document.getElementById("btn-open-search");
    if (btnSearch) btnSearch.addEventListener("click", openSearchModal);

    const searchInput = document.getElementById("global-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        renderSearchResults(searchInput.value);
      });
    }

    // Active Recall Toggle
    const btnRecall = document.getElementById("btn-toggle-recall");
    if (btnRecall) {
      btnRecall.addEventListener("click", () => {
        state.activeRecall = !state.activeRecall;
        saveState();
        applyPreferencesToDOM();
      });
    }

    // Book Preview Mode Toggle
    const btnBookMode = document.getElementById("btn-toggle-book-mode");
    if (btnBookMode) {
      btnBookMode.addEventListener("click", () => {
        state.bookPreviewMode = !state.bookPreviewMode;
        saveState();
        applyPreferencesToDOM();
        renderMainContent();
      });
    }

    // Quiz Modal Trigger
    const btnQuiz = document.getElementById("btn-open-quiz");
    if (btnQuiz) {
      btnQuiz.addEventListener("click", () => openQuizModal("cpp", "all"));
    }

    // Print Modal Trigger
    const btnPrint = document.getElementById("btn-open-print");
    if (btnPrint) {
      btnPrint.addEventListener("click", openPrintModal);
    }

    // Print Modal Controls
    const btnExecPrint = document.getElementById("btn-execute-print");
    if (btnExecPrint) {
      btnExecPrint.addEventListener("click", () => {
        const chosenScope = document.querySelector('input[name="print-scope"]:checked');
        if (chosenScope) state.printScope = chosenScope.value;
        const mcqChk = document.getElementById("print-include-mcqs");
        if (mcqChk) state.includeMcqsInPrint = mcqChk.checked;
        saveState();
        applyPreferencesToDOM();
        executeOfficialBookPrint();
      });
    }

    const btnPreviewEdition = document.getElementById("btn-preview-book-edition");
    if (btnPreviewEdition) {
      btnPreviewEdition.addEventListener("click", () => {
        const chosenScope = document.querySelector('input[name="print-scope"]:checked');
        if (chosenScope) state.printScope = chosenScope.value;
        const mcqChk = document.getElementById("print-include-mcqs");
        if (mcqChk) state.includeMcqsInPrint = mcqChk.checked;
        state.bookPreviewMode = true;
        saveState();
        closePrintModal();
        applyPreferencesToDOM();
        renderMainContent();
      });
    }

    // Theme, Font, Scale selects
    const themeSelect = document.getElementById("select-theme");
    if (themeSelect) {
      themeSelect.addEventListener("change", () => {
        state.theme = themeSelect.value;
        saveState();
        applyPreferencesToDOM();
      });
    }

    const fontSelect = document.getElementById("select-font");
    if (fontSelect) {
      fontSelect.addEventListener("change", () => {
        state.font = fontSelect.value;
        saveState();
        applyPreferencesToDOM();
      });
    }

    const scaleSelect = document.getElementById("select-scale");
    if (scaleSelect) {
      scaleSelect.addEventListener("change", () => {
        state.scale = scaleSelect.value;
        saveState();
        applyPreferencesToDOM();
      });
    }

    // Close modals on backdrop click or close button
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-close-modal");
        const modal = document.getElementById(target);
        if (modal) modal.classList.remove("open");
      });
    });

    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) backdrop.classList.remove("open");
      });
    });

    // Global Keyboard Shortcuts (Ctrl+K for search, Escape to close modals)
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearchModal();
      } else if (e.key === "Escape") {
        closeSearchModal();
        closePrintModal();
        closeQuizModal();
      }
    });
  }

  // =========================================================================
  // Boot Application
  // =========================================================================

  document.addEventListener("DOMContentLoaded", () => {
    applyPreferencesToDOM();
    initTopbarAndModals();
    renderSidebar();
    renderMainContent();
  });
})();
