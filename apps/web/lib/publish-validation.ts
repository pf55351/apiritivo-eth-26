import { buildManifest, type OperationDraft, publishServiceInputSchema, validateManifest } from "@apiritivo/shared";

export const PRIVATE_FILE_MAX_BYTES = 512 * 1024;

const detailsSchema = publishServiceInputSchema.pick({ name: true, description: true, category: true });
const pricingSchema = publishServiceInputSchema.pick({ priceUsdc: true, accessSeconds: true, payoutAddress: true, ensName: true });
const labels: Record<string, string> = {
  name: "Service name",
  description: "Description",
  category: "Category",
  priceUsdc: "Price",
  accessSeconds: "Access duration",
  payoutAddress: "Payout wallet",
  ensName: "ENS name",
};

export function privateFileIssues(file: Pick<File, "size"> | null): string[] {
  if (!file) return [];
  if (file.size === 0) return ["Choose a file that isn't empty."];
  if (file.size > PRIVATE_FILE_MAX_BYTES) return [`Choose a file of ${PRIVATE_FILE_MAX_BYTES / 1024} KB or less.`];
  return [];
}

/** Draft checks run before buildManifest can omit blanks or overwrite duplicate names. */
export function operationDraftIssues(operations: OperationDraft[]): string[] {
  const issues: string[] = [];
  const names = new Set<string>();
  for (const [index, operation] of operations.entries()) {
    const name = operation.name.trim();
    if (!name) issues.push(`Operation ${index + 1}: enter a name.`);
    else if (names.has(name)) issues.push(`Operation ${index + 1}: use a unique name.`);
    names.add(name);
    const fields = new Set<string>();
    for (const [fieldIndex, field] of operation.inputs.entries()) {
      const fieldName = field.name.trim();
      if (!fieldName) issues.push(`Operation ${index + 1}, input ${fieldIndex + 1}: enter a name or remove the field.`);
      else if (fields.has(fieldName)) issues.push(`Operation ${index + 1}, input ${fieldIndex + 1}: use a unique name.`);
      fields.add(fieldName);
    }
  }
  const manifest = validateManifest(buildManifest(operations));
  if (!manifest.ok) issues.push(...manifest.errors);
  return issues;
}

export type PublishDraft = {
  name: string;
  description: string;
  category: string;
  priceUsdc: string;
  accessSeconds: number;
  payoutAddress: string;
  ensName: string;
  operations: OperationDraft[];
  privateFile: Pick<File, "size"> | null;
};

export function publishStepIssues(draft: PublishDraft) {
  const details = detailsSchema.safeParse(draft);
  const pricing = pricingSchema.safeParse({ ...draft, payoutAddress: draft.payoutAddress.trim(), ensName: draft.ensName.trim() || undefined });
  const describe = (issues: { path: PropertyKey[]; message: string }[]) => {
    const fields = new Map<string, string>();
    for (const issue of issues) {
      const field = String(issue.path[0]);
      if (!fields.has(field)) fields.set(field, `${labels[field] ?? "Field"}: ${issue.message}`);
    }
    return [...fields.values()];
  };
  return {
    details: details.success ? [] : describe(details.error.issues),
    pricing: pricing.success ? [] : describe(pricing.error.issues),
    operations: operationDraftIssues(draft.operations),
    file: privateFileIssues(draft.privateFile),
  };
}
