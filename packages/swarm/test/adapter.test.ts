import { describe, expect, test } from "bun:test";
import { DISCONNECTED, SwarmError, downloadServiceManifest, getConnectionInfo, isSwarmReady, swarmReferenceUrl, uploadServiceManifest } from "../src";

describe("swarm adapter (not initialised)", () => {
  test("reports a disconnected session", () => {
    expect(isSwarmReady()).toBe(false);
    expect(getConnectionInfo()).toEqual(DISCONNECTED);
    expect(swarmReferenceUrl("a".repeat(64))).toBeUndefined();
  });

  test("upload fails clearly before init", async () => {
    await expect(uploadServiceManifest({ v: 1, operations: { op: { input: {} } } })).rejects.toBeInstanceOf(SwarmError);
    await expect(uploadServiceManifest({ v: 1, operations: { op: { input: {} } } })).rejects.toMatchObject({ code: "not-initialized" });
  });

  test("download fails with the documented message when no client and no gateway", async () => {
    await expect(downloadServiceManifest("a".repeat(64))).rejects.toMatchObject({
      code: "download-failed",
      message: "Manifest could not be downloaded.",
    });
  });
});
