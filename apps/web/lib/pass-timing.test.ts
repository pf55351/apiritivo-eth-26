import { afterEach, beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { type BlockTiming, secondsUntilBlock } from "@apiritivo/arkiv";
import { formatRemaining } from "@apiritivo/shared";
import { watchPassTiming } from "./pass-timing";

const timingAt = (block: number): BlockTiming => ({ currentBlock: BigInt(block), currentBlockTime: block * 2, blockDuration: 2 });
const pass = { expiresAtBlock: "115" };

async function advance(ms: number) {
  jest.advanceTimersByTime(ms);
  await Promise.resolve();
}

describe("live access expiry", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("updates a 30-second pass through its expiry block, then stops", async () => {
    const remaining: string[] = [formatRemaining(secondsUntilBlock(pass.expiresAtBlock, timingAt(100)))];
    const read = mock().mockResolvedValueOnce(timingAt(101)).mockResolvedValueOnce(timingAt(114)).mockResolvedValueOnce(timingAt(115));
    const stop = watchPassTiming([pass], timingAt(100), (timing) => remaining.push(formatRemaining(secondsUntilBlock(pass.expiresAtBlock, timing))), read);
    await advance(1_000);
    await advance(1_000);
    await advance(1_000);
    await advance(60_000);
    expect(remaining).toEqual(["30s", "28s", "2s", "expired"]);
    expect(read).toHaveBeenCalledTimes(3);
    stop();
  });

  test("polls long passes less often, then switches to fast updates near expiry", async () => {
    const read = mock().mockResolvedValueOnce(timingAt(111)).mockResolvedValue(timingAt(112));
    const stop = watchPassTiming([{ expiresAtBlock: "140" }], timingAt(100), () => {}, read);
    await advance(14_999);
    expect(read).not.toHaveBeenCalled();
    await advance(1);
    expect(read).toHaveBeenCalledTimes(1);
    await advance(1_000);
    expect(read).toHaveBeenCalledTimes(2);
    stop();
  });

  test("keeps watching another live pass after the earliest one expires", async () => {
    const read = mock().mockResolvedValueOnce(timingAt(115)).mockResolvedValueOnce(timingAt(116));
    const stop = watchPassTiming([pass, { expiresAtBlock: "116" }], timingAt(114), () => {}, read);
    await advance(1_000);
    await advance(1_000);
    await advance(30_000);
    expect(read).toHaveBeenCalledTimes(2);
    stop();
  });

  test("retries failed timing requests without inventing an expiry", async () => {
    const update = mock();
    const read = mock().mockRejectedValueOnce(new Error("RPC unavailable")).mockResolvedValueOnce(timingAt(115));
    const stop = watchPassTiming([pass], null, update, read);
    await advance(5_000);
    expect(update).not.toHaveBeenCalled();
    await advance(5_000);
    expect(update).toHaveBeenCalledWith(timingAt(115));
    stop();
  });

  test("does not overlap slow requests or update after cancellation", async () => {
    let resolve!: (timing: BlockTiming) => void;
    const read = mock(
      () =>
        new Promise<BlockTiming>((done) => {
          resolve = done;
        }),
    );
    const update = mock();
    const stop = watchPassTiming([pass], timingAt(100), update, read);
    await advance(1_000);
    await advance(30_000);
    expect(read).toHaveBeenCalledTimes(1);
    stop();
    resolve(timingAt(115));
    await advance(30_000);
    expect(update).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
  });

  test("does not poll empty, expired, or cancelled subscriptions", async () => {
    const read = mock();
    const stopEmpty = watchPassTiming([], null, () => {}, read);
    const stopExpired = watchPassTiming([pass], timingAt(115), () => {}, read);
    const stopActive = watchPassTiming([pass], timingAt(100), () => {}, read);
    stopActive();
    await advance(30_000);
    expect(read).not.toHaveBeenCalled();
    stopEmpty();
    stopExpired();
  });
});
