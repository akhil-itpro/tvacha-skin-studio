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
  ticks: { date: string; slot: "AM" | "PM"; step: string; done: boolean }[];
  shelf: ShelfItem[];
  products: Product[];
  photos: { id: string; scanId: string; createdAt: string }[];
  waitlist: boolean;
  isAdmin: boolean;
  services: { photoAnalysis: boolean; photoStorage: boolean };
};
export const dateKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
export const prettyDate = (d: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
export const money = (n: number) => "₹" + n.toLocaleString("en-IN");
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
export async function api<T = any>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch(url, {
    method,
    credentials: "same-origin",
    signal: AbortSignal.timeout(30000),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let d: any;
  try {
    d = await r.json();
  } catch {
    throw new Error(
      "Could not reach Tvacha. Check your connection and try again.",
    );
  }
  if (!r.ok)
    throw new Error(
      d.error || d.message || "This could not be saved. Please try again.",
    );
  return d;
}
