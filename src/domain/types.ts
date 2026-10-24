export const CONCERN_KEYS = ['shine', 'breakouts', 'dark_spots', 'redness', 'dryness', 'under_eye'] as const;
export type ConcernKey = typeof CONCERN_KEYS[number];
export type Confidence = 'low' | 'medium' | 'high';
export type Zone = 'forehead' | 'nose' | 'cheeks' | 'chin' | 'under-eye';
export type SkinFeel = 'oily' | 'combination' | 'normal' | 'dry';
export type BudgetBand = 'under400' | '400to800' | '800plus';
export type ProductStep = 'cleanser' | 'treatment' | 'moisturiser' | 'sunscreen';
export type Sensitivity = 'fragrance' | 'pregnant' | 'none';

export interface SkinConcern {
  key: ConcernKey;
  level: 0 | 1 | 2 | 3;
  confidence: Confidence;
  zones: Zone[];
  note: string;
}
export interface SkinAnalysis {
  image_ok: boolean;
  retake_reasons: string[];
  concerns: SkinConcern[];
}
export interface QuizAnswers {
  skinFeel: SkinFeel;
  mainConcern: ConcernKey;
  budget: BudgetBand;
  sensitivities: Sensitivity[];
  redFlags?: string[];
}
export interface Product {
  id: string;
  name: string;
  brand: string;
  step: ProductStep;
  priceInr: number;
  size: string;
  ingredients: string[];
  concerns: ConcernKey[];
  skinTypes: SkinFeel[];
  fragranceFree: boolean;
  pregnancyCaution: boolean;
  budgetBand: BudgetBand;
  url: string;
  affiliateUrl?: string;
  active: boolean;
  spf?: number;
  hasActive: boolean;
  priceCheckedAt: string;
  priceNote: string;
  description: string;
}
export interface ShelfItem {
  id: string;
  name: string;
  step: ProductStep;
  productId?: string;
  hasActive?: boolean;
}
export interface RoutineStep {
  key: ProductStep;
  title: string;
  instruction: string;
  product: Product | null;
  owned: boolean;
  ownedName?: string;
  optional: boolean;
  budgetNote?: string;
  alternatives?: Product[];
}
export interface FocusArea {
  key: ConcernKey;
  title: string;
  explanation: string;
  ingredients: string[];
  confidence?: Confidence;
}
export interface RoutinePlan {
  am: RoutineStep[];
  pm: RoutineStep[];
  focusAreas: FocusArea[];
  ingredients: string[];
  products: Product[];
  notes: string[];
  source: 'photo' | 'quiz';
  stopped: boolean;
}
export interface ConcernComparison {
  key: ConcernKey;
  change: 'better' | 'same' | 'worse' | 'not sure';
}
