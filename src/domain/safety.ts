import { CONCERN_KEYS, type Product, type QuizAnswers, type SkinAnalysis } from './types';

const ZONES = ['forehead', 'nose', 'cheeks', 'chin', 'under-eye'];
const forbidden = /\b(?:acne(?:\s+vulgaris)?|rosacea|melasma|eczema|psoriasis|fungal\s+infection|skin\s+cancer|cancer|dermatitis|infection|diagnos(?:is|e|ed|tic)|treats?|cures?|whiten(?:ing)?|lighten(?:ing)?|fair(?:ness)?|ethnicity|ethnic|attractiv(?:e|eness)|skin\s+colou?r|skin\s+tone\s+(?:rank|score)|tretinoin|hydroquinone|steroid|antibiotic|caucasian|asian|hispanic|latino|latina|indian\s+skin)\b|\b(?:age[d]?\s*(?:is|:|=)?\s*\d|\d{1,3}\s*(?:years?\s*old|year-old|y\.?o\.?))|\byour\s+skin\s+(?:is|looks?)\s+(?:dark|light|white|black|brown)\b/i;
const unsafeIngredient = /\b(?:tretinoin|hydroquinone|steroids?|corticosteroids?|antibiotics?|clobetasol|betamethasone|mometasone|hydrocortisone|clindamycin|adapalene|benzoyl\s+peroxide|mercury|retinol|retinoids?|retinal)\b/i;
const exfoliatingAcid = /\b(?:salicylic|glycolic|mandelic|lactic)\s+acid\b|\b(?:AHA|BHA|LHA)\b/i;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const boundedString = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const exactKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const normalize = (text: string) => text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');

export function containsForbiddenLanguage(text: string): boolean {
  return forbidden.test(normalize(text));
}

export function containsRestrictedProductLanguage(text: string): boolean {
  return containsForbiddenLanguage(text) || unsafeIngredient.test(normalize(text));
}

/** Fail closed: a plausible looking score must never stand in for a valid model response. */
export function validateAnalysis(raw: unknown): SkinAnalysis | null {
  if (!object(raw) || !exactKeys(raw, ['image_ok', 'retake_reasons', 'concerns'])) return null;
  if (typeof raw.image_ok !== 'boolean' || !Array.isArray(raw.retake_reasons) || raw.retake_reasons.length > 5) return null;
  if (!raw.retake_reasons.every(reason => boundedString(reason, 160) && !containsForbiddenLanguage(reason))) return null;
  if (!raw.image_ok && raw.retake_reasons.length === 0) return null;
  if (!Array.isArray(raw.concerns) || raw.concerns.length !== CONCERN_KEYS.length) return null;
  const keys = new Set<string>();
  for (const concern of raw.concerns) {
    if (!object(concern) || !exactKeys(concern, ['key', 'level', 'confidence', 'zones', 'note'])) return null;
    if (!CONCERN_KEYS.includes(concern.key as typeof CONCERN_KEYS[number]) || keys.has(String(concern.key))) return null;
    if (concern.level !== null && (!Number.isInteger(concern.level) || Number(concern.level) < 0 || Number(concern.level) > 3)) return null;
    if (!['low', 'medium', 'high'].includes(String(concern.confidence))) return null;
    if (concern.level === null && (concern.confidence !== 'low' || !Array.isArray(concern.zones) || concern.zones.length !== 0)) return null;
    if (!Array.isArray(concern.zones) || concern.zones.length > ZONES.length || !concern.zones.every(zone => ZONES.includes(String(zone)))) return null;
    if (new Set(concern.zones).size !== concern.zones.length) return null;
    if (!boundedString(concern.note, 160) || concern.note.trim().split(/\s+/).length > 20 || containsForbiddenLanguage(concern.note)) return null;
    keys.add(String(concern.key));
  }
  return JSON.parse(JSON.stringify(raw)) as SkinAnalysis;
}

export function validateQuiz(raw: unknown): QuizAnswers | null {
  if (!object(raw) || !['oily', 'combination', 'normal', 'dry'].includes(String(raw.skinFeel))) return null;
  if (!CONCERN_KEYS.includes(raw.mainConcern as typeof CONCERN_KEYS[number]) || !['under400', '400to800', '800plus'].includes(String(raw.budget))) return null;
  if (!Array.isArray(raw.sensitivities) || raw.sensitivities.length < 1 || raw.sensitivities.length > 2) return null;
  if (!raw.sensitivities.every(item => ['fragrance', 'pregnant', 'none'].includes(String(item)))) return null;
  if (new Set(raw.sensitivities).size !== raw.sensitivities.length || (raw.sensitivities.includes('none') && raw.sensitivities.length !== 1)) return null;
  if (raw.redFlags !== undefined && (!Array.isArray(raw.redFlags) || raw.redFlags.length > 4 || !raw.redFlags.every(flag => boundedString(flag, 120)))) return null;
  return { skinFeel: raw.skinFeel, mainConcern: raw.mainConcern, budget: raw.budget, sensitivities: [...raw.sensitivities], redFlags: raw.redFlags ? [...raw.redFlags as string[]] : [] } as QuizAnswers;
}

export function isSafeProduct(product: Product): boolean {
  const text = [product.name, product.brand, product.description, ...product.ingredients].join(' ');
  if (product.step === 'treatment' && !product.hasActive) return false;
  // An incorrectly edited flag must not turn an exfoliating formula into a gentle essential.
  if (exfoliatingAcid.test(normalize([product.name, ...product.ingredients].join(' '))) && (!product.hasActive || !product.pregnancyCaution)) return false;
  return !containsRestrictedProductLanguage(text) && product.active;
}

export function validateProduct(raw: unknown): Product | null {
  if (!object(raw) || !boundedString(raw.id, 100) || !/^[a-z0-9][a-z0-9_-]*$/i.test(raw.id)) return null;
  if (!boundedString(raw.name, 160) || !boundedString(raw.brand, 80) || !boundedString(raw.size, 40) || !boundedString(raw.description, 280)) return null;
  if (!['cleanser', 'treatment', 'moisturiser', 'sunscreen'].includes(String(raw.step))) return null;
  if (typeof raw.priceInr !== 'number' || !Number.isFinite(raw.priceInr) || raw.priceInr < 1 || raw.priceInr > 100000) return null;
  if (!Array.isArray(raw.ingredients) || raw.ingredients.length < 1 || raw.ingredients.length > 30 || !raw.ingredients.every(value => boundedString(value, 100))) return null;
  if (!Array.isArray(raw.concerns) || !raw.concerns.every(value => CONCERN_KEYS.includes(value as typeof CONCERN_KEYS[number]))) return null;
  if (!Array.isArray(raw.skinTypes) || raw.skinTypes.length < 1 || !raw.skinTypes.every(value => ['oily', 'combination', 'normal', 'dry'].includes(String(value)))) return null;
  if (['fragranceFree', 'pregnancyCaution', 'active', 'hasActive'].some(key => typeof raw[key] !== 'boolean')) return null;
  if (!['under400', '400to800', '800plus'].includes(String(raw.budgetBand))) return null;
  const expectedBand = raw.priceInr < 400 ? 'under400' : raw.priceInr <= 800 ? '400to800' : '800plus';
  if (raw.budgetBand !== expectedBand) return null;
  if (raw.step === 'sunscreen' && (typeof raw.spf !== 'number' || !Number.isFinite(raw.spf) || raw.spf < 30 || raw.spf > 100)) return null;
  try {
    for (const link of [raw.url, raw.affiliateUrl].filter(Boolean)) {
      const url = new URL(String(link));
      if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|0\.|10\.|192\.168\.|\[|169\.254\.)/i.test(url.hostname)) return null;
    }
  } catch { return null; }
  if (!boundedString(raw.url, 2048) || !boundedString(raw.priceNote, 200) || !/^\d{4}-\d{2}-\d{2}$/.test(String(raw.priceCheckedAt))) return null;
  const product = JSON.parse(JSON.stringify(raw)) as Product;
  // Inactive entries remain editable, but no restricted product can enter the catalogue.
  return isSafeProduct({ ...product, active: true }) ? product : null;
}
