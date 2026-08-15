export const PREFERENCE_DEFAULTS = Object.freeze({
  apiKey: "",
  modelId: "",
  reasoningEffort: "default",
  requireZdr: true,
  theme: "system",
});

export async function getPreferences() {
  const saved = await chrome.storage.local.get(Object.keys(PREFERENCE_DEFAULTS));
  return { ...PREFERENCE_DEFAULTS, ...saved };
}

export function applyTheme(theme) {
  const resolved = theme === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  document.documentElement.dataset.theme = resolved === "dark" ? "dark" : "light";
}

export function followSystemTheme(getTheme) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const listener = () => {
    if (getTheme() === "system") applyTheme("system");
  };
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
