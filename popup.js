import { AngleprobeError, analyseWithOpenRouter } from "./lib/openrouter-client.js";
import { applyTheme, followSystemTheme, getPreferences } from "./lib/preferences.js";

const MAX_TEXT_LENGTH = 5_000;
const ACTIVE_TEXT_KEY = "activeText";
const ACTIVE_ANALYSIS_KEY = "activeAnalysis";

const elements = {
  analyseButton: document.querySelector("#analyseButton"),
  assessmentBadge: document.querySelector("#assessmentBadge"),
  characterCount: document.querySelector("#characterCount"),
  contextList: document.querySelector("#contextList"),
  contextSection: document.querySelector("#contextSection"),
  copyRewriteButton: document.querySelector("#copyRewriteButton"),
  issueCount: document.querySelector("#issueCount"),
  issuesList: document.querySelector("#issuesList"),
  issuesSection: document.querySelector("#issuesSection"),
  limitationsList: document.querySelector("#limitationsList"),
  limitationsSection: document.querySelector("#limitationsSection"),
  modelMeta: document.querySelector("#modelMeta"),
  neutralRewrite: document.querySelector("#neutralRewrite"),
  overview: document.querySelector("#overview"),
  results: document.querySelector("#results"),
  rewriteSection: document.querySelector("#rewriteSection"),
  resetButton: document.querySelector("#resetButton"),
  selectionHint: document.querySelector("#selectionHint"),
  selectionText: document.querySelector("#selectionText"),
  settingsButton: document.querySelector("#settingsButton"),
  errorSettingsButton: document.querySelector("#errorSettingsButton"),
  statusMessage: document.querySelector("#statusMessage"),
  statusText: document.querySelector("#statusText"),
};

let selectedText = "";

elements.settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.errorSettingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.resetButton.addEventListener("click", resetActiveState);
elements.analyseButton.addEventListener("click", analyseSelection);
elements.copyRewriteButton.addEventListener("click", copyRewrite);

initialise();

async function initialise() {
  const preferences = await getPreferences();
  applyTheme(preferences.theme);
  followSystemTheme(() => preferences.theme);
  const saved = await chrome.storage.local.get([ACTIVE_TEXT_KEY, ACTIVE_ANALYSIS_KEY]);
  if (saved[ACTIVE_TEXT_KEY]) {
    selectedText = saved[ACTIVE_TEXT_KEY];
    showSelection();
    if (saved[ACTIVE_ANALYSIS_KEY]) renderAnalysis(saved[ACTIVE_ANALYSIS_KEY]);
    return;
  }

  try {
    selectedText = await readCurrentSelection();
  } catch {
    showStatus("Chrome does not allow text capture on this page. Try a normal webpage.", "error");
  }

  if (!selectedText) return showEmptySelection();

  await chrome.storage.local.set({ [ACTIVE_TEXT_KEY]: selectedText });
  showSelection();
}

function showSelection() {
  elements.selectionHint.hidden = true;
  elements.selectionText.textContent = selectedText;
  elements.characterCount.textContent = `${selectedText.length.toLocaleString()} characters`;
  elements.analyseButton.disabled = selectedText.length > MAX_TEXT_LENGTH;

  if (selectedText.length > MAX_TEXT_LENGTH) {
    showStatus(`Please select no more than ${MAX_TEXT_LENGTH.toLocaleString()} characters.`, "error");
  }
}

function showEmptySelection() {
  elements.selectionHint.hidden = false;
  elements.selectionText.replaceChildren();
  elements.characterCount.textContent = "";
  elements.analyseButton.disabled = true;
}

async function resetActiveState() {
  await chrome.storage.local.remove([ACTIVE_TEXT_KEY, ACTIVE_ANALYSIS_KEY]);
  selectedText = "";
  elements.results.hidden = true;
  hideStatus();
  try {
    selectedText = await readCurrentSelection();
  } catch {
    showStatus("Chrome cannot capture text on this page. Try a normal webpage.", "error");
  }
  if (!selectedText) {
    showEmptySelection();
    showStatus("Reset complete. Highlight new text, then reopen Angleprobe or press Reset again.", "info");
    return;
  }
  await chrome.storage.local.set({ [ACTIVE_TEXT_KEY]: selectedText });
  showSelection();
}

async function readCurrentSelection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return "";

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection()?.toString().trim() ?? "",
  });
  return results[0]?.result ?? "";
}

async function analyseSelection() {
  hideStatus();
  setLoading(true);
  elements.results.hidden = true;

  try {
    const preferences = await getPreferences();
    const body = await analyseWithOpenRouter({ text: selectedText }, preferences);

    await chrome.storage.local.set({ [ACTIVE_ANALYSIS_KEY]: body });
    renderAnalysis(body);
  } catch (error) {
    if (error instanceof AngleprobeError) {
      showStatus(error.message, "error", true);
    } else {
      showStatus("Angleprobe could not complete this analysis. Retry or choose another model.", "error", true);
    }
  } finally {
    setLoading(false);
  }
}

function renderAnalysis(response) {
  const analysis = response.analysis;
  elements.results.hidden = false;
  elements.overview.textContent = analysis.overview;
  renderAssessment(analysis.overall_assessment, analysis.issues.length);
  renderSelectedText(analysis.issues);
  renderIssues(analysis.issues);
  renderContext(analysis.missing_context);
  renderRewrite(analysis.neutral_rewrite);
  renderLimitations(analysis.limitations);
  elements.modelMeta.textContent = `Model: ${response.model?.id ?? "OpenRouter"}`;
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

function renderSelectedText(issues) {
  const ranges = issues
    .map((issue) => issue.location)
    .filter((location) =>
      Number.isInteger(location?.start) &&
      Number.isInteger(location?.end) &&
      location.start >= 0 &&
      location.end > location.start &&
      location.end <= selectedText.length
    )
    .sort((left, right) => left.start - right.start);

  elements.selectionText.replaceChildren();
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    elements.selectionText.append(document.createTextNode(selectedText.slice(cursor, range.start)));
    const mark = document.createElement("mark");
    mark.textContent = selectedText.slice(range.start, range.end);
    elements.selectionText.append(mark);
    cursor = range.end;
  }
  elements.selectionText.append(document.createTextNode(selectedText.slice(cursor)));
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

function renderRewrite(rewrite) {
  elements.rewriteSection.hidden = rewrite === null;
  elements.neutralRewrite.textContent = rewrite ?? "";
  elements.copyRewriteButton.textContent = "Copy";
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

async function copyRewrite() {
  await navigator.clipboard.writeText(elements.neutralRewrite.textContent);
  elements.copyRewriteButton.textContent = "Copied";
  setTimeout(() => { elements.copyRewriteButton.textContent = "Copy"; }, 1_400);
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

function setLoading(loading) {
  elements.analyseButton.disabled = loading || !selectedText || selectedText.length > MAX_TEXT_LENGTH;
  elements.resetButton.disabled = loading;
  elements.analyseButton.classList.toggle("loading", loading);
  elements.analyseButton.querySelector(".button-label").textContent = loading ? "Analysing…" : "Analyse selection";
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
