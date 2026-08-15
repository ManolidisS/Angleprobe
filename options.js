import { AngleprobeError, fetchModelCatalog, reasoningOptionsFor } from "./lib/openrouter-client.js";
import { applyTheme, followSystemTheme, getPreferences } from "./lib/preferences.js";

const CATALOG_KEY = "modelCatalog";
const CATALOG_FETCHED_KEY = "modelCatalogFetchedAt";
const CATALOG_MAX_AGE_MS = 6 * 60 * 60 * 1_000;

const elements = {
  apiKey: document.querySelector("#apiKey"),
  clearKey: document.querySelector("#clearKeyButton"),
  form: document.querySelector("#settingsForm"),
  modelFilter: document.querySelector("#modelFilter"),
  modelMeta: document.querySelector("#modelMeta"),
  modelSelect: document.querySelector("#modelSelect"),
  reasoningEffort: document.querySelector("#reasoningEffort"),
  reasoningHelp: document.querySelector("#reasoningHelp"),
  refreshModels: document.querySelector("#refreshModelsButton"),
  requireZdr: document.querySelector("#requireZdr"),
  status: document.querySelector("#statusMessage"),
  theme: document.querySelector("#theme"),
  toggleKey: document.querySelector("#toggleKeyButton"),
};

let catalog = [];
let savedModelId = "";
let savedReasoningEffort = "default";
let currentTheme = "system";

elements.toggleKey.addEventListener("click", () => {
  const reveal = elements.apiKey.type === "password";
  elements.apiKey.type = reveal ? "text" : "password";
  elements.toggleKey.textContent = reveal ? "Hide" : "Show";
});

elements.clearKey.addEventListener("click", async () => {
  elements.apiKey.value = "";
  await chrome.storage.local.remove("apiKey");
  showStatus("The saved OpenRouter key was removed from this browser.", "success");
});

elements.theme.addEventListener("change", () => {
  currentTheme = elements.theme.value;
  applyTheme(currentTheme);
});

elements.modelFilter.addEventListener("input", () => {
  renderModelOptions(elements.modelSelect.value);
  updateModelDetails();
});
elements.modelSelect.addEventListener("change", () => {
  savedModelId = elements.modelSelect.value;
  savedReasoningEffort = "default";
  updateModelDetails("default");
});
elements.refreshModels.addEventListener("click", () => refreshModels(false));

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const apiKey = elements.apiKey.value.trim();
  const modelId = elements.modelSelect.value;
  if (!apiKey) return showStatus("Enter your OpenRouter API key.", "error");
  if (!modelId) return showStatus("Choose a model after the model list finishes loading.", "error");

  await chrome.storage.local.set({
    apiKey,
    modelId,
    reasoningEffort: elements.reasoningEffort.value,
    requireZdr: elements.requireZdr.checked,
    theme: elements.theme.value,
  });
  savedModelId = modelId;
  savedReasoningEffort = elements.reasoningEffort.value;
  showStatus("Settings saved. Angleprobe is ready.", "success");
});

initialise();

async function initialise() {
  const [preferences, cached] = await Promise.all([
    getPreferences(),
    chrome.storage.local.get([CATALOG_KEY, CATALOG_FETCHED_KEY]),
  ]);
  currentTheme = preferences.theme;
  applyTheme(currentTheme);
  followSystemTheme(() => currentTheme);

  elements.apiKey.value = preferences.apiKey;
  elements.requireZdr.checked = preferences.requireZdr;
  elements.theme.value = preferences.theme;
  savedModelId = preferences.modelId;
  savedReasoningEffort = preferences.reasoningEffort;

  if (Array.isArray(cached[CATALOG_KEY])) {
    catalog = cached[CATALOG_KEY];
    renderModelOptions(savedModelId);
    updateModelDetails(savedReasoningEffort);
  }

  const age = Date.now() - Number(cached[CATALOG_FETCHED_KEY] ?? 0);
  await refreshModels(catalog.length > 0 && age < CATALOG_MAX_AGE_MS);
}

async function refreshModels(skipNetwork) {
  if (skipNetwork) return;
  elements.refreshModels.disabled = true;
  elements.refreshModels.textContent = "Refreshing…";
  showStatus("Refreshing compatible models from OpenRouter…", "info");
  try {
    const previous = savedModelId || elements.modelSelect.value;
    const previousEffort = savedReasoningEffort || elements.reasoningEffort.value;
    catalog = await fetchModelCatalog();
    await chrome.storage.local.set({ [CATALOG_KEY]: catalog, [CATALOG_FETCHED_KEY]: Date.now() });

    let selected = previous;
    if (!catalog.some((model) => model.id === selected)) {
      selected = chooseDefaultModel(catalog);
      if (previous) {
        savedReasoningEffort = "default";
        await chrome.storage.local.set({ modelId: selected, reasoningEffort: "default" });
        showStatus("The previous model is no longer compatible. Angleprobe selected a current alternative; review and save Settings.", "info");
      } else {
        showStatus(`Loaded ${catalog.length} compatible models. Choose one and save Settings.`, "success");
      }
    } else {
      showStatus(`Model list refreshed: ${catalog.length} compatible models.`, "success");
    }
    savedModelId = selected;
    renderModelOptions(selected);
    updateModelDetails(selected === previous ? previousEffort : "default");
  } catch (error) {
    const message = error instanceof AngleprobeError
      ? error.message
      : "Could not refresh OpenRouter models. Cached choices remain available.";
    showStatus(message, "error");
  } finally {
    elements.refreshModels.disabled = false;
    elements.refreshModels.textContent = "Refresh models";
  }
}

function renderModelOptions(preferredId) {
  const query = elements.modelFilter.value.trim().toLowerCase();
  const visible = catalog.filter((model) =>
    !query || model.name.toLowerCase().includes(query) || model.id.toLowerCase().includes(query),
  );
  elements.modelSelect.replaceChildren();
  if (visible.length === 0) {
    const option = new Option(catalog.length ? "No matching models" : "Loading models…", "");
    elements.modelSelect.add(option);
    elements.modelSelect.disabled = true;
    return;
  }
  for (const model of visible) {
    elements.modelSelect.add(new Option(`${model.name} — ${model.id}`, model.id));
  }
  elements.modelSelect.disabled = false;
  const target = visible.some((model) => model.id === preferredId) ? preferredId : visible[0].id;
  elements.modelSelect.value = target;
}

function updateModelDetails(preferredEffort) {
  const model = catalog.find((item) => item.id === elements.modelSelect.value);
  if (!model) {
    elements.modelMeta.textContent = "";
    elements.reasoningEffort.replaceChildren(new Option("Not available", "default"));
    elements.reasoningEffort.disabled = true;
    return;
  }

  const promptPrice = formatPerMillion(model.pricing?.prompt);
  const completionPrice = formatPerMillion(model.pricing?.completion);
  const context = model.contextLength ? `${model.contextLength.toLocaleString()} token context` : "context unknown";
  elements.modelMeta.textContent = `${context} · input ${promptPrice}/M · output ${completionPrice}/M`;

  const efforts = reasoningOptionsFor(model);
  elements.reasoningEffort.replaceChildren();
  elements.reasoningEffort.add(new Option(
    model.reasoning?.defaultEffort ? `Model default (${model.reasoning.defaultEffort})` : "Model default",
    "default",
  ));
  for (const effort of efforts) elements.reasoningEffort.add(new Option(capitalize(effort), effort));
  elements.reasoningEffort.disabled = efforts.length === 0;
  elements.reasoningHelp.textContent = efforts.length
    ? "Choices come from the current OpenRouter model metadata."
    : "This model does not advertise configurable reasoning.";

  const desired = preferredEffort ?? elements.reasoningEffort.value;
  elements.reasoningEffort.value = [...elements.reasoningEffort.options].some((option) => option.value === desired)
    ? desired
    : "default";
}

function chooseDefaultModel(models) {
  const preferred = ["google/gemini-3.7-flash", "google/gemini-2.5-flash", "openai/gpt-5-mini"];
  return preferred.find((id) => models.some((model) => model.id === id)) ?? models[0]?.id ?? "";
}

function formatPerMillion(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "?";
  if (number === 0) return "$0";
  const amount = number * 1_000_000;
  return `$${amount < 0.01 ? amount.toFixed(3) : amount.toFixed(2)}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function showStatus(message, kind) {
  elements.status.textContent = message;
  elements.status.className = `status-message visible ${kind}`;
}
