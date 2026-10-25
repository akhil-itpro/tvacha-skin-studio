"use client";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage, type AppState } from "./types";

/** Refreshing or changing identity immediately discards all previously loaded pages. */
export function useHistory<K extends "scans" | "photos">(state: AppState | null, kind: K) {
  type T = AppState[K][number];
  const initial = (state?.[kind] || []) as T[];
  const firstCursor = kind === "scans" ? state?.nextScanCursor : state?.nextPhotoCursor;
  const [page, setPage] = useState<{ base: AppState; items: T[]; cursor: string | null; loading: boolean; error: string } | null>(null);
  const latest = useRef(state); latest.current = state;
  const pending = useRef<{ base: AppState; controller: AbortController } | null>(null);
  useEffect(() => () => { pending.current?.controller.abort(); pending.current = null; }, [state]);
  const current = page?.base === state ? page : null;
  const cursor = current ? current.cursor : firstCursor;
  const items = [...new Map([...initial, ...(current?.items || [])].map(item => [item.id, item])).values()];
  async function loadMore() {
    if (!state || !cursor || pending.current?.base === state) return;
    const base = state, controller = new AbortController(), previous = current?.items || [];
    pending.current = { base, controller };
    setPage({ base, items: previous, cursor, loading: true, error: "" });
    try {
      const result = await api<Record<string, unknown> & { nextCursor: string | null }>("/api/" + kind + "?cursor=" + encodeURIComponent(cursor), "GET", undefined, { signal: controller.signal });
      if (latest.current === base && !controller.signal.aborted)
        setPage({ base, items: [...previous, ...(result[kind] as T[])], cursor: result.nextCursor, loading: false, error: "" });
    } catch (error) {
      if (latest.current === base && !controller.signal.aborted)
        setPage({ base, items: previous, cursor, loading: false, error: errorMessage(error) });
    } finally { if (pending.current?.controller === controller) pending.current = null; }
  }
  return { items, hasMore: !!cursor, loading: current?.loading || false, error: current?.error || "", loadMore };
}
