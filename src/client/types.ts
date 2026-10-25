import type {
  Product,
  QuizAnswers,
  ShelfItem,
  SkinAnalysis,
} from "../domain/types";
import type { IngredientRules } from "../domain/recommendations";
export type Scan = {
  id: string;
  createdAt: string;
  quiz: QuizAnswers;
  analysis: SkinAnalysis | null;
  source: "photo" | "quiz";
  message?: string;
  model?: string;
};
export type AppState = {
  rules?: IngredientRules;
  inviteCode?: string | null;
  user: { id: string; email?: string; name?: string; isGuest: boolean };
  profile: {
    ageConfirmed: boolean;
    quiz: QuizAnswers | null;
    createdAt: string;
  } | null;
  consents: { analysis: boolean; progressPhotos: boolean };
  scans: Scan[];
  scanCount: number;
  nextScanCursor: string | null;
  ticks: { date: string; slot: "AM" | "PM"; step: string; done: boolean }[];
  shelf: ShelfItem[];
  products: Product[];
  photos: { id: string; scanId: string; createdAt: string }[];
  photoCount: number;
  nextPhotoCursor: string | null;
  siteDetails: { operatorName: string; supportEmail: string };
  waitlist: boolean;
  isAdmin: boolean;
  services: {
    photoAnalysis: boolean;
    photoStorage: boolean;
    photoProvider?: string;
    photoModel?: string;
    photoAnalysisReason?: string;
  };
};
export const dateKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
export const prettyDate = (d: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
export const money = (n: number) => "₹" + n.toLocaleString("en-IN");
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function canUseQuizFallback(error: unknown): boolean {
  return error instanceof ApiError
    ? error.status >= 500
    : error instanceof TypeError ||
        (error instanceof DOMException && error.name === "TimeoutError");
}
export async function api<T = any>(
  url: string,
  method = "GET",
  body?: unknown,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  // Basic AbortController also works on older iPhones without AbortSignal.any/timeout.
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 30000);
  try {
    const r = await fetch(url, {
      method,
      credentials: "same-origin",
      signal: controller.signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let d: any;
    try {
      d = await r.json();
    } catch {
      if (controller.signal.aborted)
        throw new DOMException("Request cancelled", "AbortError");
      throw new ApiError(
        r.status === 401 || r.status === 403
          ? "Your session needs attention. Sign in again, then retry."
          : "Could not read the server response. Please try again.",
        r.ok ? 502 : r.status,
      );
    }
    if (!r.ok)
      throw new ApiError(
        d.error || d.message || "This could not be saved. Please try again.",
        r.status,
      );
    return d;
  } catch (error) {
    if (timedOut)
      throw new DOMException(
        "The request took too long. Please try again.",
        "TimeoutError",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
