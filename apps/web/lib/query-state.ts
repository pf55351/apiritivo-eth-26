import type { BlockTiming } from "@apiritivo/arkiv";
import type { FriendlyError } from "./errors";

export type QueryState<T> = {
  key: string | null;
  data: T | null;
  loading: boolean;
  error: FriendlyError | null;
  timing: BlockTiming | null;
};

type Action<T> =
  | { type: "start"; key: string | null }
  | { type: "success"; key: string; data: T; timing: BlockTiming | null }
  | { type: "failure"; key: string; error: FriendlyError };

export function emptyQuery<T>(key: string | null): QueryState<T> {
  return { key, data: null, loading: key !== null, error: null, timing: null };
}

/** A refresh can retain a snapshot only when it belongs to the same account/query. */
export function queryState<T>(state: QueryState<T>, action: Action<T>): QueryState<T> {
  if (action.type === "start") {
    return action.key !== null && action.key === state.key ? { ...state, loading: true, error: null } : emptyQuery(action.key);
  }
  if (action.key !== state.key) return state;
  if (action.type === "failure") return { ...state, loading: false, error: action.error };
  return { key: action.key, data: action.data, loading: false, error: null, timing: newerBlockTiming(state.timing, action.timing) };
}

/** Concurrent list and clock reads must not make an expiry countdown run backwards. */
export function newerBlockTiming(first: BlockTiming | null, second: BlockTiming | null): BlockTiming | null {
  if (!first) return second;
  if (!second) return first;
  return second.currentBlock >= first.currentBlock ? second : first;
}
