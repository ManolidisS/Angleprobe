import { AngleprobeError, analyseWithOpenRouter } from "./lib/openrouter-client.js";
import { applyTheme, followSystemTheme, getPreferences } from "./lib/preferences.js";

const ACTIVE_CAPTURE_KEY = "activeCapture";
const ACTIVE_ANALYSIS_KEY = "activeAnalysis";
const LEGACY_TEXT_KEY = "activeText";

const elements = {
  analyseButton: document.querySelector("#analyseButton"),
  analysePageButton: document.querySelector("#analysePageButton"),
  assessmentBadge: document.querySelector("#assessmentBadge"),
  characterCount: document.querySelector("#characterCount"),
  contextList: document.querySelector("#contextList"),
  contextSection: document.querySelector("#contextSection"),
  errorSettingsButton: document.querySelector("#errorSettingsButton"),
  issueCount: document.querySelector("#issueCount"),
  issuesList: document.querySelector("#issuesList"),
  issuesSection: document.querySelector("#issuesSection"),
  limitationsList: document.querySelector("#limitationsList"),
  limitationsSection: document.querySelector("#limitationsSection"),
  modelMeta: document.querySelector("#modelMeta"),
  overview: document.querySelector("#overview"),
  results: document.querySelector("#results"),
  resetButton: document.querySelector("#resetButton"),
  selectionHeading: document.querySelector("#selectionHeading"),
  selectionHint: document.querySelector("#selectionHint"),
  selectionText: document.querySelector("#selectionText"),
  settingsButton: document.querySelector("#settingsButton"),
  sourcesList: document.querySelector("#sourcesList"),
  sourcesSection: document.querySelector("#sourcesSection"),
  statusMessage: document.querySelector("#statusMessage"),
  statusText: document.querySelector("#statusText"),
};

let capture = null;

elements.settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.errorSettingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.resetButton.addEventListener("click", resetActiveState);
elements.analyseButton.addEventListener("click", () => analyseCapture());
elements.analysePageButton.addEventListener("click", analyseCurrentPage);

initialise();

async function initialise() {
  const preferences = await getPreferences();
  applyTheme(preferences.theme);
  followSystemTheme(() => preferences.theme);
  const saved = await chrome.storage.local.get([ACTIVE_CAPTURE_KEY, ACTIVE_ANALYSIS_KEY, LEGACY_TEXT_KEY]);

  if (saved[ACTIVE_CAPTURE_KEY]?.text) {
    capture = saved[ACTIVE_CAPTURE_KEY];
  } else if (saved[LEGACY_TEXT_KEY]) {
    capture = { text: saved[LEGACY_TEXT_KEY], mode: "selection", source_url: null, source_title: null };
    await chrome.storage.local.set({ [ACTIVE_CAPTURE_KEY]: capture });
    await chrome.storage.local.remove(LEGACY_TEXT_KEY);
  } else {
    try {
      capture = await readCurrentSelection();
    } catch {
      showStatus("Chrome does not allow text capture on this page. Try a normal webpage.", "error");
    }
    if (capture) await chrome.storage.local.set({ [ACTIVE_CAPTURE_KEY]: capture });
  }

  if (capture) showCapture();
  else showEmptyCapture();
  if (saved[ACTIVE_ANALYSIS_KEY]) renderAnalysis(saved[ACTIVE_ANALYSIS_KEY]);
}

function showCapture() {
  elements.selectionHint.hidden = true;
  elements.selectionHeading.textContent = capture.mode === "page" ? "Page text" : "Selected text";
  elements.selectionText.textContent = capture.text;
  elements.characterCount.textContent = `${capture.text.length.toLocaleString()} characters`;
  elements.analyseButton.disabled = false;
}

function showEmptyCapture() {
  elements.selectionHeading.textContent = "Selected text";
  elements.selectionHint.hidden = false;
  elements.selectionHint.textContent = "Highlight text to analyse it, or analyse the readable text from this page.";
  elements.selectionText.replaceChildren();
  elements.characterCount.textContent = "";
  elements.analyseButton.disabled = true;
}

async function resetActiveState() {
  await chrome.storage.local.remove([ACTIVE_CAPTURE_KEY, ACTIVE_ANALYSIS_KEY, LEGACY_TEXT_KEY]);
  capture = null;
  elements.results.hidden = true;
  hideStatus();
  try {
    capture = await readCurrentSelection();
  } catch {
    showStatus("Chrome cannot capture text on this page. Try a normal webpage.", "error");
  }
  if (!capture) {
    showEmptyCapture();
    showStatus("Reset complete. Highlight new text or choose Analyse page.", "info");
    return;
  }
  await chrome.storage.local.set({ [ACTIVE_CAPTURE_KEY]: capture });
  showCapture();
}

async function readCurrentSelection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection()?.toString().trim() ?? "",
  });
  const text = results[0]?.result ?? "";
  if (!text) return null;
  return {
    text,
    mode: "selection",
    source_url: tab.url ?? null,
    source_title: tab.title ?? null,
  };
}

async function readCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const source = document.querySelector("article") ?? document.querySelector("main") ?? document.body;
      if (!source) return "";
      const clone = source.cloneNode(true);
      clone.querySelectorAll([
        "script", "style", "noscript", "template", "svg", "canvas", "iframe",
        "nav", "footer", "form", "button", "input", "select", "textarea",
        "[hidden]", "[aria-hidden='true']", "[role='navigation']", "[role='banner']",
        "[role='contentinfo']", ".advertisement", ".ads", ".cookie-banner",
      ].join(",")).forEach((element) => element.remove());
      return (clone.innerText || clone.textContent || "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    },
  });
  const text = results[0]?.result ?? "";
  if (!text) return null;
  return {
    text,
    mode: "page",
    source_url: tab.url ?? null,
    source_title: tab.title ?? null,
  };
}

async function analyseCurrentPage() {
  hideStatus();
  setLoading(true, "Reading page…");
  try {
    const pageCapture = await readCurrentPage();
    if (!pageCapture) {
      showStatus("Angleprobe could not find readable text on this page.", "error");
      return;
    }
    capture = pageCapture;
    await chrome.storage.local.set({ [ACTIVE_CAPTURE_KEY]: capture });
    await chrome.storage.local.remove(ACTIVE_ANALYSIS_KEY);
    elements.results.hidden = true;
    showCapture();
    elements.analyseButton.querySelector(".button-label").textContent = "Analysing…";
    await analyseCapture(true);
  } catch {
    showStatus("Chrome cannot read this page. Try a normal article or select a passage instead.", "error");
  } finally {
    setLoading(false);
  }
}

async function analyseCapture(alreadyLoading = false) {
  if (!capture?.text) return;
  hideStatus();
  if (!alreadyLoading) setLoading(true);
  elements.results.hidden = true;

  try {
    const preferences = await getPreferences();
    const body = await analyseWithOpenRouter(capture, preferences);
    await chrome.storage.local.set({ [ACTIVE_ANALYSIS_KEY]: body });
    renderAnalysis(body);
  } catch (error) {
    if (error instanceof AngleprobeError) {
      showStatus(error.message, "error", true);
    } else {
      showStatus("Angleprobe could not complete this analysis. Retry or choose another model.", "error", true);
    }
  } finally {
    if (!alreadyLoading) setLoading(false);
  }
}

function renderAnalysis(response) {
  const analysis = response.analysis;
  elements.results.hidden = false;
  elements.overview.textContent = analysis.overview;
  renderAssessment(analysis.overall_assessment, analysis.issues.length);
  renderHighlightedText(analysis.issues);
  renderIssues(analysis.issues);
  renderContext(analysis.missing_context);
  renderLimitations(analysis.limitations);
  renderSources(response.sources ?? []);
  const verified = response.web_verification ? " · web verification enabled" : "";
  elements.modelMeta.textContent = `Model: ${response.model?.id ?? "OpenRouter"}${verified}`;
}

function renderAssessment(assessment, issueCount) {
  const labels = {
    no_major_issue_found: ["No major issue found", "clear"],
    potential_concerns_found: ["Potential concerns", "concerns"],
    insufficient_information: ["More information needed", "unknown"],
  };
  const [label, className] = labels[assessment] ?? ["Analysis complete", "unknown"];
  elements.assessmentBadge.textContent = label;
  elements.assessmentBadge.className = `assessment-badge ${className}`;
  elements.issueCount.textContent = `${issueCount} issue${issueCount === 1 ? "" : "s"}`;
}

function renderHighlightedText(issues) {
  if (!capture?.text) return;
  const ranges = issues
    .map((issue) => issue.location)
    .filter((location) =>
      Number.isInteger(location?.start) && Number.isInteger(location?.end) &&
      location.start >= 0 && location.end > location.start && location.end <= capture.text.length
    )
    .sort((left, right) => left.start - right.start);

  elements.selectionText.replaceChildren();
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    elements.selectionText.append(document.createTextNode(capture.text.slice(cursor, range.start)));
    const mark = document.createElement("mark");
    mark.textContent = capture.text.slice(range.start, range.end);
    elements.selectionText.append(mark);
    cursor = range.end;
  }
  elements.selectionText.append(document.createTextNode(capture.text.slice(cursor)));
}

function renderIssues(issues) {
  elements.issuesList.replaceChildren();
  elements.issuesSection.hidden = issues.length === 0;
  for (const issue of issues) {
    const card = createCard("issue-card");
    const topline = document.createElement("div");
    topline.className = "issue-topline";
    const dot = document.createElement("span");
    dot.className = `issue-dot ${issue.type}`;
    const type = document.createElement("span");
    type.className = "issue-type";
    type.textContent = formatIssueType(issue.type);
    const severity = document.createElement("span");
    severity.className = "severity";
    severity.textContent = `${issue.severity} severity`;
    topline.append(dot, type, severity);
    const quote = document.createElement("p");
    quote.className = "issue-quote";
    quote.textContent = `“${issue.quote}”`;
    const explanation = document.createElement("p");
    explanation.className = "issue-explanation";
    explanation.textContent = issue.explanation;
    card.append(topline, quote, explanation);
    elements.issuesList.append(card);
  }
}

function renderContext(items) {
  elements.contextList.replaceChildren();
  elements.contextSection.hidden = items.length === 0;
  for (const item of items) {
    const card = createCard("context-card");
    const heading = document.createElement("h3");
    heading.textContent = item.item;
    const explanation = document.createElement("p");
    explanation.textContent = item.why_it_matters;
    card.append(heading, explanation);
    elements.contextList.append(card);
  }
}

function renderLimitations(limitations) {
  elements.limitationsList.replaceChildren();
  elements.limitationsSection.hidden = limitations.length === 0;
  for (const limitation of limitations) {
    const item = document.createElement("li");
    item.textContent = limitation;
    elements.limitationsList.append(item);
  }
}

function renderSources(sources) {
  elements.sourcesList.replaceChildren();
  elements.sourcesSection.hidden = sources.length === 0;
  for (const source of sources) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = source.title;
    item.append(link);
    elements.sourcesList.append(item);
  }
}

function createCard(className) {
  const card = document.createElement("article");
  card.className = `${className} card`;
  return card;
}

function formatIssueType(type) {
  return {
    language: "Language",
    statistics: "Statistics",
    potential_factual_issue: "Check the facts",
  }[type] ?? "Issue";
}

function setLoading(loading, label = "Analysing…") {
  elements.analyseButton.disabled = loading || !capture?.text;
  elements.analysePageButton.disabled = loading;
  elements.resetButton.disabled = loading;
  elements.analyseButton.classList.toggle("loading", loading);
  elements.analyseButton.querySelector(".button-label").textContent = loading ? label : "Analyse text";
}

function showStatus(message, kind, showSettings = false) {
  elements.statusText.textContent = message;
  elements.statusMessage.className = `status-message visible ${kind}`;
  elements.errorSettingsButton.hidden = !showSettings;
}

function hideStatus() {
  elements.statusText.textContent = "";
  elements.statusMessage.className = "status-message";
  elements.errorSettingsButton.hidden = true;
}
