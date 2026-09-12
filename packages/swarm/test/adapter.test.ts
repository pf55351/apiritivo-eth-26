import { describe, expect, test } from "bun:test";
import { DISCONNECTED, SwarmError, downloadPrivateFile, downloadServiceManifest, driveFromBatch, getConnectionInfo, getGranteeKey, getSwarmDrive, grantPrivateFile, isSwarmReady, swarmReferenceUrl, uploadPrivateFile, uploadServiceManifest } from "../src";

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

describe("swarm drive", () => {
  test("getSwarmDrive fails clearly before init", async () => {
    await expect(getSwarmDrive()).rejects.toMatchObject({ code: "not-initialized" });
  });

  test("maps a Bee batch to a drive with percent used and ttl", () => {
    const drive = driveFromBatch({ batchID: "ab".repeat(32), label: "demo", utilization: 4, depth: 20, bucketDepth: 16, batchTTL: 4 * 86_400, usable: true });
    expect(drive.batchId).toBe("ab".repeat(32));
    expect(drive.usedPercent).toBe(25);
    expect(drive.ttlSeconds).toBe(345_600);
    expect(drive.usable).toBe(true);
  });

  test("clamps and tolerates missing ttl", () => {
    const drive = driveFromBatch({ batchID: "00".repeat(32), label: "", utilization: 99, depth: 17, bucketDepth: 16, usable: false });
    expect(drive.usedPercent).toBe(100);
    expect(drive.ttlSeconds).toBeUndefined();
  });
});

describe("private files (ACT) · not initialised", () => {
  test("no grantee key while signed out", () => {
    expect(getGranteeKey()).toBeUndefined();
  });
  test("upload, grant and download fail with not-initialized", async () => {
    await expect(uploadPrivateFile(new Uint8Array([1]))).rejects.toMatchObject({ code: "not-initialized" });
    await expect(grantPrivateFile("a".repeat(64), "02" + "b".repeat(64))).rejects.toMatchObject({ code: "not-initialized" });
    await expect(downloadPrivateFile({ encryptedRef: "a".repeat(128), historyRef: "a".repeat(64), publisherPubKey: "02" + "b".repeat(64) })).rejects.toMatchObject({ code: "not-initialized" });
  });
});
