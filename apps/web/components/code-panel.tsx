"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { copyText } from "@/lib/format";

/** Text only: examples and real manifests use the same panel without executing code. */
export function CodePanel({
  title,
  code,
  language = "JSON",
  footer,
}: {
  title: string;
  code: string;
  language?: string;
  footer?: ReactNode;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="min-w-0 overflow-hidden rounded-panel border border-line bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2.5">
        <span className="min-w-0 truncate font-mono text-xs text-muted">{title}</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-subtle">{language}</span>
          <button
            type="button"
            aria-label={`Copy ${title}`}
            onClick={async () => {
              const ok = await copyText(code);
              setCopyState(ok ? "copied" : "failed");
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setCopyState("idle"), 2500);
            }}
            className="min-h-8 rounded-control border border-line px-2.5 text-xs text-muted hover:border-line-strong hover:text-content"
          >
            {copyState === "copied" ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
      <pre tabIndex={0} role="region" aria-label={title} className="overflow-auto px-4 py-5 font-mono text-xs leading-7 text-ink-200 sm:px-5">
        <code>{code.split("\n").map((line, index) => (
          <span key={index} className="block min-h-7">
            <span aria-hidden="true" className="mr-5 inline-block w-4 select-none text-right text-subtle/70">{index + 1}</span>
            {line}
          </span>
        ))}</code>
      </pre>
      <span role="status" className={copyState === "failed" ? "block px-4 pb-3 text-xs text-rose-400" : "sr-only"}>
        {copyState === "copied" ? "Code copied to clipboard." : copyState === "failed" ? "Copy unavailable. Select the code to copy it manually." : ""}
      </span>
      {footer ? <div className="border-t border-line px-4 py-3 text-xs leading-relaxed text-subtle">{footer}</div> : null}
    </div>
  );
}
