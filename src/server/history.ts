import { z } from "zod";

export const HISTORY_PAGE_SIZE = 30;
const cursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
}).strict();
export function historyOptions(params: URLSearchParams) {
  const limit = z.coerce.number().int().min(1).max(50).parse(params.get("limit") ?? HISTORY_PAGE_SIZE);
  const raw = params.get("cursor");
  if (!raw) return { limit, cursor: null };
  let decoded: unknown;
  try {
    if (raw.length > 240 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error();
    decoded = JSON.parse(atob(raw.replaceAll("-", "+").replaceAll("_", "/")));
  } catch { decoded = null; }
  return { limit, cursor: cursorSchema.parse(decoded) };
}
export function historyCursor(row: Record<string, unknown>): string {
  return btoa(JSON.stringify({ createdAt: row.created_at, id: row.id }))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
/** Stable keyset pagination: inserting a newer label cannot shift an older page. */
export function historyQuery(table: "scans" | "progress_photos", cursor: boolean) {
  const fields = table === "scans" ? "*" : "id,scan_id,created_at";
  return `SELECT ${fields} FROM ${table} WHERE owner_id = ?${cursor ? " AND (created_at < ? OR (created_at = ? AND id < ?))" : ""} ORDER BY created_at DESC, id DESC LIMIT ?`;
}
