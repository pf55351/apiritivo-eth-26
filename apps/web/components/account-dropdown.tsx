"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

/** The same account entry point stays available before and after sign-in. */
export function AccountDropdown({ label, trigger, children }: { label: string; trigger: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="sm:relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-11 items-center justify-center gap-2 rounded-full border border-transparent p-1 transition-colors hover:border-line hover:bg-surface sm:w-auto sm:justify-start sm:pr-3"
      >
        {trigger}
        <span className="hidden text-xs text-subtle sm:inline" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <section
          id={id}
          aria-label="Account settings"
          onClickCapture={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) close();
          }}
          className="absolute right-3 top-full z-50 mt-2 max-h-[calc(100dvh-10rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-panel sm:right-0 sm:top-auto"
        >
          {children(close)}
        </section>
      ) : null}
    </div>
  );
}

export function GuestAccountIcon() {
  return (
    <span className="inline-flex size-[34px] items-center justify-center rounded-full bg-surface-active text-content-secondary">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </svg>
    </span>
  );
}
