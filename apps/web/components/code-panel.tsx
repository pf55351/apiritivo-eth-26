"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/format";

/**
 * Scrollable code region. Focusable so keyboard users can scroll it (WCAG 2.1.1);
 * the section carries the name so assistive tech announces what the code is.
 */
export function CodeBlock({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable code region must be keyboard reachable
    <section tabIndex={0} aria-label={label} className={className}>
      <pre>{children}</pre>
    </section>
  );
}

/** Text only: examples and real manifests use the same panel without executing code. */
export function CodePanel({
  title,
  code,
  language = "JSON",
  footer,
  header,
}: {
  title: string;
  code: string;
  language?: string;
  footer?: ReactNode;
  /** Optional format controls replace the filename in the single toolbar. */
  header?: ReactNode;
}) {
  const [copyResult, setCopyResult] = useState<{ code: string; state: "copied" | "failed" } | null>(null);
  const copyState = copyResult?.code === code ? copyResult.state : "idle";
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="min-w-0 overflow-hidden rounded-panel border border-line bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2">
        {header ?? <span className="min-w-0 truncate text-xs text-muted">{title}</span>}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-subtle">{language}</span>
          <button
            type="button"
            aria-label={`Copy ${title}`}
            onClick={async () => {
              const ok = await copyText(code);
              setCopyResult({ code, state: ok ? "copied" : "failed" });
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setCopyResult(null), 2500);
            }}
            className="ui-button"
            data-variant="subtle"
            data-size="sm"
          >
            {copyState === "copied" ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
      <CodeBlock label={title} className="overflow-auto p-5 font-mono text-sm leading-6 text-ink-200">
        <code>{code}</code>
      </CodeBlock>
      <span role="status" className={copyState === "failed" ? "block px-4 pb-3 text-xs text-rose-400" : "sr-only"}>
        {copyState === "copied" ? "Code copied to clipboard." : copyState === "failed" ? "Copy unavailable. Select the code to copy it manually." : ""}
      </span>
      {footer ? <div className="border-t border-line px-4 py-3 text-xs leading-relaxed text-subtle">{footer}</div> : null}
    </div>
  );
}
