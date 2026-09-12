"use client";

import type { Role } from "@apiritivo/shared";
import { useSession } from "./session";

export type View = { view: Role; loaded: boolean };

/**
 * The workspace the interface shows. "client" until the saved preference is
 * read; `loaded` tells callers when that default is still a placeholder, so
 * identity-bound chrome can wait instead of flashing the wrong account.
 */
export function useView(): View {
  const { role, roleLoaded } = useSession();
  return { view: role ?? "client", loaded: roleLoaded };
}
