"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "./ui";

export type FormStep = {
  id: string;
  title: string;
  summary?: string;
  issues: string[];
  optional?: boolean;
  hasValue?: boolean;
  children: ReactNode;
};

/** One open step, with mounted fields so collapsing never discards a draft or file selection. */
export function FormSteps({ id, steps, disabled = false, onSubmit }: { id: string; steps: FormStep[]; disabled?: boolean; onSubmit: () => void }) {
  const [active, setActive] = useState<string | null>(steps[0]?.id ?? null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [attempted, setAttempted] = useState<string[]>([]);
  const headings = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusNext = useRef(false);
  const lastIndex = steps.length - 1;
  const isComplete = (step: FormStep) => completed.includes(step.id) && step.issues.length === 0;
  const completeCount = steps.slice(0, -1).filter(isComplete).length;

  useEffect(() => {
    if (focusNext.current && active) {
      headings.current[active]?.focus();
      focusNext.current = false;
    }
  }, [active]);

  function finish(index: number) {
    const step = steps[index];
    if (!step || disabled || index === lastIndex) return;
    setAttempted((current) => (current.includes(step.id) ? current : [...current, step.id]));
    if (step.issues.length) return;
    setCompleted((current) => (current.includes(step.id) ? current : [...current, step.id]));
    focusNext.current = true;
    setActive(steps[index + 1]!.id);
  }

  function toggle(nextId: string) {
    const current = steps.find((step) => step.id === active);
    if (current && current.id !== steps[lastIndex]?.id && current.issues.length === 0 && (!current.optional || current.hasValue)) {
      setCompleted((done) => (done.includes(current.id) ? done : [...done, current.id]));
    }
    setActive(active === nextId ? null : nextId);
  }

  return (
    <form
      className="min-w-0"
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing || !(event.target instanceof HTMLInputElement) || event.target.type === "file") return;
        const index = steps.findIndex((step) => step.id === active);
        if (index !== lastIndex) {
          event.preventDefault();
          finish(Math.max(index, 0));
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        const index = steps.findIndex((step) => step.id === active);
        // Enter in a draft field advances the form; only the review step can publish.
        if (index !== lastIndex) finish(Math.max(index, 0));
        else if (steps.every((step) => step.issues.length === 0)) onSubmit();
      }}
    >
      <p className="mb-3 text-xs text-subtle" role="status">
        {completeCount} of {lastIndex} steps complete
      </p>
      <fieldset disabled={disabled} className="min-w-0">
        {steps.map((step, index) => {
          const open = active === step.id;
          const review = index === lastIndex;
          const complete = isComplete(step);
          const showIssues = step.issues.length > 0 && ((review && open) || attempted.includes(step.id) || completed.includes(step.id));
          const status = complete
            ? step.optional && !step.hasValue
              ? "Skipped"
              : "Validated"
            : showIssues
              ? "Check fields"
              : review && step.issues.length === 0
                ? "Ready"
                : step.optional
                  ? "Optional"
                  : open
                    ? "In progress"
                    : "";
          const headingId = `${id}-${step.id}-heading`;
          const panelId = `${id}-${step.id}-panel`;
          return (
            <section key={step.id} className="min-w-0 border-t border-line">
              <h2>
                <button
                  ref={(element) => {
                    headings.current[step.id] = element;
                  }}
                  id={headingId}
                  type="button"
                  data-form-step-toggle=""
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(step.id)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-control py-4 text-left sm:gap-4"
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums ${complete ? "border-success/30 bg-success/10 text-success" : open ? "border-accent-text text-accent-text" : "border-line text-subtle"}`}
                  >
                    {complete ? (
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-heading text-lg font-medium sm:text-xl">{step.title}</span>
                      {status ? <span className={`text-xs ${complete || status === "Ready" ? "text-success" : showIssues ? "text-warning" : "text-subtle"}`}>{status}</span> : null}
                    </span>
                    {!open && step.summary ? <span className="mt-1 block truncate text-xs text-subtle">{step.summary}</span> : null}
                  </span>
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-subtle transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </h2>
              <section
                id={panelId}
                aria-labelledby={headingId}
                hidden={!open}
                onChangeCapture={(event) => {
                  if (event.target instanceof HTMLInputElement && event.target.type === "file") {
                    setAttempted((current) => (current.includes(step.id) ? current : [...current, step.id]));
                  }
                }}
                onBlurCapture={(event) => {
                  if (!open || review || disabled || (step.optional && !step.hasValue)) return;
                  if (step.issues.length === 0) setCompleted((current) => (current.includes(step.id) ? current : [...current, step.id]));
                  const next = event.relatedTarget;
                  if (next instanceof Element && (next.closest("a, [data-form-step-toggle]") || (event.currentTarget.contains(next) && !next.closest("[data-form-step-continue]"))))
                    return;
                  finish(index);
                }}
              >
                <div className="space-y-5 pb-6 pt-2 sm:pl-12">
                  {step.children}
                  {showIssues ? (
                    <ul className="space-y-1 break-words text-xs text-warning" aria-live="polite">
                      {step.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}
                  {!review ? (
                    <div data-form-step-continue="">
                      <Button variant="ghost" onClick={() => finish(index)}>
                        {step.optional && !step.hasValue ? "Skip file" : "Continue"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </section>
            </section>
          );
        })}
      </fieldset>
    </form>
  );
}
