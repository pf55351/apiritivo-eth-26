export type Theme = "dark" | "light";
export type ThemePreference = Theme | "system";

export const THEME_STORAGE_KEY = "apiritivo:theme";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";
const CHANGE_EVENT = "apiritivo:theme-change";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): Theme {
  return preference === "system" ? (prefersDark ? "dark" : "light") : preference;
}

export function currentThemePreference(): ThemePreference {
  return parseThemePreference(document.documentElement.dataset.themePreference);
}

function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = resolveTheme(preference, window.matchMedia(SYSTEM_THEME_QUERY).matches);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The DOM keeps this page's choice when persistence is unavailable.
  }
  applyTheme(preference);
}

export function subscribeTheme(onChange: () => void) {
  const systemTheme = window.matchMedia(SYSTEM_THEME_QUERY);
  const onSystemChange = () => {
    if (currentThemePreference() === "system") applyTheme("system");
  };
  const onStorage = (event: StorageEvent) => {
    try {
      if (event.storageArea !== window.localStorage) return;
    } catch {
      return;
    }
    if (event.key === THEME_STORAGE_KEY || event.key === null) applyTheme(parseThemePreference(event.newValue));
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  systemTheme.addEventListener("change", onSystemChange);
  // Catch a system change between the startup script and React mounting.
  onSystemChange();
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    systemTheme.removeEventListener("change", onSystemChange);
  };
}

// Runs before the body paints. Storage can be unavailable in private contexts.
// Only known preference and resolved theme values may become DOM attributes.
export const THEME_INIT_SCRIPT = `(()=>{let p="system";try{const v=localStorage.getItem("${THEME_STORAGE_KEY}");if(v==="light"||v==="dark")p=v}catch{}const r=document.documentElement;r.dataset.themePreference=p;r.dataset.theme=p==="system"?(matchMedia("${SYSTEM_THEME_QUERY}").matches?"dark":"light"):p})()`;
