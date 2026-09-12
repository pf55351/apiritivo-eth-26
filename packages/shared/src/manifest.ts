import { z } from "zod";

/**
 * Reduced technical manifest stored on Swarm.
 * Answers: "How can a machine use this service?"
 * Discovery metadata (name, category, provider…) lives on Arkiv, never here.
 */
export const OPERATION_INPUT_TYPES = ["string", "number", "boolean"] as const;
export type OperationInputType = (typeof OPERATION_INPUT_TYPES)[number];

export const operationInputTypeSchema = z.enum(OPERATION_INPUT_TYPES);

const identifier = z
  .string()
  .min(1, "Required")
  .max(64, "Max 64 characters")
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letters, digits and underscores; start with a letter");

export const operationSchema = z.object({
  input: z.record(identifier, operationInputTypeSchema),
});

export const serviceManifestSchema = z.object({
  v: z.literal(1),
  /** Optional HTTP endpoint a machine calls with `Authorization: Bearer <accessPassKey>`. */
  endpoint: z.string().url("Endpoint must be a valid URL").optional(),
  operations: z.record(identifier, operationSchema).refine((ops) => Object.keys(ops).length > 0, {
    message: "At least one operation is required",
  }),
});

export type ServiceManifest = z.infer<typeof serviceManifestSchema>;
export type ServiceOperation = z.infer<typeof operationSchema>;

/** Form-level representation used by the operations builder. */
export type OperationInputDraft = { id: string; name: string; type: OperationInputType };
export type OperationDraft = { id: string; name: string; inputs: OperationInputDraft[] };

/**
 * Build a manifest from the friendly form drafts. Does not validate; call
 * `validateManifest` afterwards to get user-facing errors.
 */
export function buildManifest(operations: OperationDraft[], endpoint?: string): ServiceManifest {
  const ops: ServiceManifest["operations"] = {};
  for (const op of operations) {
    const name = op.name.trim();
    if (!name) continue;
    const input: Record<string, OperationInputType> = {};
    for (const field of op.inputs) {
      const fieldName = field.name.trim();
      if (!fieldName) continue;
      input[fieldName] = field.type;
    }
    ops[name] = { input };
  }
  const trimmed = endpoint?.trim();
  return trimmed ? { v: 1, endpoint: trimmed, operations: ops } : { v: 1, operations: ops };
}

export type ManifestValidation =
  | { ok: true; manifest: ServiceManifest }
  | { ok: false; errors: string[] };

export function validateManifest(value: unknown): ManifestValidation {
  const parsed = serviceManifestSchema.safeParse(value);
  if (parsed.success) return { ok: true, manifest: parsed.data };
  const errors = parsed.error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") + ": " : "";
    return `${path}${issue.message}`;
  });
  return { ok: false, errors: Array.from(new Set(errors)) };
}

export function serializeManifest(manifest: ServiceManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function manifestToBytes(manifest: ServiceManifest): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(manifest));
}

export function manifestFromBytes(bytes: Uint8Array): ManifestValidation {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, errors: ["Manifest is not valid JSON"] };
  }
  return validateManifest(json);
}

/** Count of operations and inputs, handy for cards and previews. */
export function manifestStats(manifest: ServiceManifest): { operations: number; inputs: number } {
  const ops = Object.values(manifest.operations);
  return {
    operations: ops.length,
    inputs: ops.reduce((sum, op) => sum + Object.keys(op.input).length, 0),
  };
}
