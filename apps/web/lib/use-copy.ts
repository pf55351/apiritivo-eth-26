"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyText } from "./format";

const SHOW_MS = 1_200;

/**
 * Clipboard with a short "Copied" state. `copied` is the key of the last
 * successful copy (so one hook can serve several buttons), cleared after a
 * moment; the timer is cancelled on unmount.
 */
export function useCopy(): { copied: string | null; copy: (key: string, text: string) => Promise<boolean> } {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = useCallback(async (key: string, text: string) => {
    const ok = await copyText(text);
    if (!ok) return false;
    setCopied(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), SHOW_MS);
    return true;
  }, []);
  return { copied, copy };
}
