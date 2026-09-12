import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { toEventSelector, toFunctionSelector } from "viem";
import { paymentsAbi } from "../src/contract";

/**
 * The app's ABI is hand-written. When Foundry has compiled the contract
 * (`contracts/out` is gitignored, so this only runs after `forge build`),
 * every function and event selector must match the artifact, and the artifact
 * must not expose anything the app ABI forgot.
 */
const artifactPath = new URL("../../../contracts/out/APIritivoPayments.sol/APIritivoPayments.json", import.meta.url).pathname;

type AbiItem = { type: string; name?: string; inputs?: { type: string; indexed?: boolean; components?: unknown[] }[] };

describe.skipIf(!existsSync(artifactPath))("payments ABI matches the Foundry artifact", () => {
  const artifact = (JSON.parse(readFileSync(artifactPath, "utf8")) as { abi: AbiItem[] }).abi;
  const selectors = (items: readonly unknown[], type: "function" | "event") =>
    new Set(
      (items as AbiItem[])
        .filter((i) => i.type === type)
        // biome-ignore lint/suspicious/noExplicitAny: the two ABI encodings share the shape the selector helpers read
        .map((i) => (type === "function" ? toFunctionSelector(i as any) : toEventSelector(i as any))),
    );

  test("every artifact function exists in the app ABI with the same selector", () => {
    const app = selectors(paymentsAbi, "function");
    const chain = selectors(artifact, "function");
    expect([...chain].filter((s) => !app.has(s))).toEqual([]);
    expect([...app].filter((s) => !chain.has(s))).toEqual([]);
  });

  test("every artifact event exists in the app ABI with the same topic", () => {
    const app = selectors(paymentsAbi, "event");
    const chain = selectors(artifact, "event");
    expect([...chain].filter((s) => !app.has(s))).toEqual([]);
    expect([...app].filter((s) => !chain.has(s))).toEqual([]);
  });

  test("custom errors are declared too", () => {
    const names = new Set(artifact.filter((i) => i.type === "error").map((i) => i.name));
    const appNames = new Set((paymentsAbi as unknown as readonly AbiItem[]).filter((i) => i.type === "error").map((i) => i.name));
    expect([...names].filter((n) => !appNames.has(n))).toEqual([]);
  });
});
