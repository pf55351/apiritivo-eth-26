import { describe, expect, test } from "bun:test";
import { operationDraftIssues, PRIVATE_FILE_MAX_BYTES, type PublishDraft, privateFileIssues, publishStepIssues } from "./publish-validation";

const valid: PublishDraft = {
  name: "Market API",
  description: "Crypto prices for any symbol.",
  category: "market-data",
  priceUsdc: "0.50",
  accessSeconds: 30,
  payoutAddress: `0x${"1".repeat(40)}`,
  ensName: "",
  operations: [{ id: "operation", name: "getQuote", inputs: [{ id: "input", name: "symbol", type: "string" }] }],
  privateFile: null,
};

describe("publish step validation", () => {
  test("accepts complete required steps with no optional ENS or file", () => {
    expect(publishStepIssues(valid)).toEqual({ details: [], pricing: [], operations: [], file: [] });
  });
  test("incomplete names, descriptions and custom categories stay in API details", () => {
    const issues = publishStepIssues({ ...valid, name: " ", description: "short", category: "" });
    expect(issues.details).toHaveLength(3);
    expect(issues.pricing).toEqual([]);
  });
  test("editing a valid step to an invalid value revokes its validation", () => {
    expect(publishStepIssues(valid).pricing).toEqual([]);
    expect(publishStepIssues({ ...valid, priceUsdc: "-1" }).pricing).toHaveLength(1);
    expect(publishStepIssues({ ...valid, accessSeconds: 0 }).pricing).toHaveLength(1);
    expect(publishStepIssues({ ...valid, payoutAddress: "" }).pricing).toHaveLength(1);
    expect(publishStepIssues({ ...valid, ensName: "not-an-ens" }).pricing).toHaveLength(1);
  });
  test("optional ENS values are checked when supplied", () => {
    expect(publishStepIssues({ ...valid, ensName: "  MYAPI.eth " }).pricing).toEqual([]);
  });
  test("blank operation and input rows cannot be silently dropped", () => {
    expect(operationDraftIssues([{ id: "1", name: "", inputs: [] }]).length).toBeGreaterThan(0);
    expect(operationDraftIssues([{ id: "1", name: "ping", inputs: [{ id: "2", name: " ", type: "string" }] }])).toHaveLength(1);
  });
  test("rejects duplicate operation or input names after trimming", () => {
    expect(
      operationDraftIssues([
        { id: "1", name: "ping", inputs: [] },
        { id: "2", name: " ping ", inputs: [] },
      ]),
    ).toHaveLength(1);
    expect(
      operationDraftIssues([
        {
          id: "1",
          name: "ping",
          inputs: [
            { id: "2", name: "symbol", type: "string" },
            { id: "3", name: " symbol ", type: "number" },
          ],
        },
      ]),
    ).toHaveLength(1);
  });
  test("rejects invalid identifiers and permits operations with fields deliberately removed", () => {
    expect(operationDraftIssues([{ id: "1", name: "get quote", inputs: [] }]).length).toBeGreaterThan(0);
    expect(operationDraftIssues([{ id: "1", name: "ping", inputs: [] }])).toEqual([]);
    expect(operationDraftIssues([]).length).toBeGreaterThan(0);
  });
  test("checks the private file before upload, including the size boundary", () => {
    expect(privateFileIssues(null)).toEqual([]);
    expect(privateFileIssues({ size: 0 })).toHaveLength(1);
    expect(privateFileIssues({ size: PRIVATE_FILE_MAX_BYTES })).toEqual([]);
    expect(privateFileIssues({ size: PRIVATE_FILE_MAX_BYTES + 1 })).toHaveLength(1);
    expect(publishStepIssues({ ...valid, privateFile: { size: 0 } }).file).toHaveLength(1);
  });
});
