"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { currentThemePreference, DEFAULT_THEME_PREFERENCE, setThemePreference, subscribeTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {theme === "system" ? (
        <>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8m-4-4v4" strokeLinecap="round" />
        </>
      ) : theme === "light" ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </>
      ) : (
        <path d="M20.5 14.1A8.7 8.7 0 0 1 9.9 3.5a8.7 8.7 0 1 0 10.6 10.6Z" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** Keep Auto and cross-tab preferences live while the account dropdown is closed. */
export function ThemeSync() {
  useEffect(() => subscribeTheme(() => {}), []);
  return null;
}

export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribeTheme, currentThemePreference, () => DEFAULT_THEME_PREFERENCE);
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-sm text-muted" aria-hidden="true">
        Theme
      </span>
      <fieldset className="flex gap-1">
        <legend className="sr-only">Color theme</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className="relative" title={option.value === "system" ? "Auto: follows your computer" : `${option.label} theme`}>
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={preference === option.value}
              aria-label={`${option.label} theme`}
              onChange={() => setThemePreference(option.value)}
              className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <span className="flex h-11 w-11 items-center justify-center rounded-control border border-transparent text-subtle peer-checked:border-line-strong peer-checked:bg-surface-raised peer-checked:text-content peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-hover:text-content">
              <ThemeIcon theme={option.value} />
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
