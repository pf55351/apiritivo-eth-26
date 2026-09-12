"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { currentThemePreference, setThemePreference, subscribeTheme, type ThemePreference } from "@/lib/theme";

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

export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribeTheme, currentThemePreference, () => "system" as ThemePreference);
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const currentLabel = OPTIONS.find((option) => option.value === preference)?.label ?? "Auto";

  function closeAndFocus() {
    setOpen(false);
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={`Color theme: ${currentLabel}`}
        title={preference === "system" ? "Auto: follows your computer" : `${currentLabel} theme`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="theme-toggle flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-surface-raised hover:text-content"
      >
        <ThemeIcon theme={preference} />
      </button>
      {open ? (
        <div id={id} role="dialog" aria-label="Choose color theme" className="absolute right-0 top-full z-50 mt-2 rounded-panel border border-line bg-surface p-1 shadow-lg">
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
                  onClick={(event) => {
                    if (event.detail > 0) closeAndFocus();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      closeAndFocus();
                    }
                  }}
                  className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span className="flex h-11 w-11 items-center justify-center rounded-control border border-transparent text-subtle peer-checked:border-line-strong peer-checked:bg-surface-raised peer-checked:text-content peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-hover:text-content">
                  <ThemeIcon theme={option.value} />
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}
