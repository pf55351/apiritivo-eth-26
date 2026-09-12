"use client";

import { OPERATION_INPUT_TYPES, type OperationDraft, type OperationInputType } from "@apiperitivo/shared";
import { Button } from "./ui";

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyOperation(name = ""): OperationDraft {
  return { id: newId(), name, inputs: [{ id: newId(), name: "", type: "string" }] };
}

const inputCls =
  "h-10 w-full rounded-xl border border-white/15 bg-ink-900/70 px-3 font-mono text-sm text-ink-100 placeholder:text-ink-400 focus:border-spritz-400/60 focus:outline-none";

export function OperationsBuilder({
  operations,
  onChange,
}: {
  operations: OperationDraft[];
  onChange: (next: OperationDraft[]) => void;
}) {
  const update = (id: string, patch: Partial<OperationDraft>) =>
    onChange(operations.map((op) => (op.id === id ? { ...op, ...patch } : op)));

  return (
    <div className="space-y-4">
      {operations.map((op, index) => (
        <div key={op.id} className="rounded-2xl border border-white/15 bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Operation {index + 1}</span>
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
            <span className="mb-1 block text-xs text-ink-300">Operation name</span>
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
            <span className="mb-2 block text-xs text-ink-300">Input fields</span>
            <div className="space-y-2">
              {op.inputs.map((field) => (
                <div key={field.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                  <input
                    className={inputCls}
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
                    className="h-10 rounded-xl border border-white/15 bg-ink-900/70 px-3 font-mono text-sm text-ink-100 focus:border-spritz-400/60 focus:outline-none"
                    value={field.type}
                    onChange={(e) =>
                      update(op.id, {
                        inputs: op.inputs.map((f) =>
                          f.id === field.id ? { ...f, type: e.target.value as OperationInputType } : f,
                        ),
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
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-ink-400 hover:border-rose-400/40 hover:text-rose-400"
                    title="Remove field"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => update(op.id, { inputs: [...op.inputs, { id: newId(), name: "", type: "string" }] })}
              >
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
