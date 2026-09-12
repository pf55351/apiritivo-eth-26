import { type BlockTiming, getBlockTiming, secondsUntilBlock } from "@apiritivo/arkiv";
import type { AccessPass } from "@apiritivo/shared";

/** Refresh the chain clock without reloading passes or guessing whether a block has been mined. */
export function watchPassTiming(
  passes: readonly Pick<AccessPass, "expiresAtBlock">[],
  initialTiming: BlockTiming | null,
  onTiming: (timing: BlockTiming) => void,
  readTiming: () => Promise<BlockTiming> = getBlockTiming,
): () => void {
  let cancelled = false;
  let timing = initialTiming;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule(retry = false) {
    if (cancelled || passes.length === 0) return;
    const remaining = timing ? passes.map((pass) => secondsUntilBlock(pass.expiresAtBlock, timing!)).filter((seconds) => seconds > 0) : null;
    if (remaining?.length === 0) return;
    const delay = retry || !remaining ? 5_000 : Math.min(...remaining) <= 60 ? 1_000 : 15_000;
    timer = setTimeout(async () => {
      try {
        const next = await readTiming();
        if (cancelled) return;
        timing = next;
        onTiming(next);
        schedule();
      } catch {
        // Keep the last confirmed state through transient RPC failures.
        schedule(true);
      }
    }, delay);
  }

  schedule();
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
