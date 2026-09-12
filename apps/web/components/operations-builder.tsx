"use client";

import { OPERATION_INPUT_TYPES, type OperationDraft, type OperationInputType } from "@apiritivo/shared";
import { Button } from "./ui";

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyOperation(name = ""): OperationDraft {
  return { id: newId(), name, inputs: [{ id: newId(), name: "", type: "string" }] };
}

const inputCls = "field-control font-mono";

export function OperationsBuilder({ operations, onChange }: { operations: OperationDraft[]; onChange: (next: OperationDraft[]) => void }) {
  const update = (id: string, patch: Partial<OperationDraft>) => onChange(operations.map((op) => (op.id === id ? { ...op, ...patch } : op)));

  return (
    <div className="space-y-4">
      {operations.map((op, index) => (
        <div key={op.id} className="border-b border-line pb-5 last:border-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-normal text-subtle">Operation {index + 1}</span>
            <div className="ml-auto">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => onChange(operations.filter((o) => o.id !== op.id))}
                disabled={operations.length === 1}
                title={operations.length === 1 ? "Keep at least one operation" : "Remove operation"}
              >
                Remove
              </Button>
            </div>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs text-muted">Operation name</span>
            <input
              className={inputCls}
              placeholder="getQuote"
              value={op.name}
              onChange={(e) => update(op.id, { name: e.target.value })}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>

          <div className="mt-4">
            <span className="mb-2 block text-xs text-muted">Input fields</span>
            <div className="space-y-2">
              {op.inputs.map((field) => (
                <div key={field.id} className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_2.375rem]">
                  <input
                    className={`${inputCls} col-span-2 sm:col-span-1`}
                    aria-label={`Input name for ${op.name || `operation ${index + 1}`}`}
                    placeholder="symbol"
                    value={field.name}
                    onChange={(e) =>
                      update(op.id, {
                        inputs: op.inputs.map((f) => (f.id === field.id ? { ...f, name: e.target.value } : f)),
                      })
                    }
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <select
                    className="field-control font-mono sm:w-auto"
                    aria-label={`Type of ${field.name || "input field"}`}
                    value={field.type}
                    onChange={(e) =>
                      update(op.id, {
                        inputs: op.inputs.map((f) => (f.id === field.id ? { ...f, type: e.target.value as OperationInputType } : f)),
                      })
                    }
                  >
                    {OPERATION_INPUT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => update(op.id, { inputs: op.inputs.filter((f) => f.id !== field.id) })}
                    className="field-control flex items-center justify-center p-0 text-subtle hover:text-danger"
                    aria-label={`Remove ${field.name || "input field"}`}
                    title="Remove field"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                      <path d="m6 6 12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Button variant="ghost" size="sm" onClick={() => update(op.id, { inputs: [...op.inputs, { id: newId(), name: "", type: "string" }] })}>
                + Add input field
              </Button>
            </div>
          </div>
        </div>
      ))}
      <Button variant="ghost" onClick={() => onChange([...operations, emptyOperation()])}>
        + Add operation
      </Button>
    </div>
  );
}
