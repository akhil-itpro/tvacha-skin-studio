import { z } from 'zod';
export const concernKeys = ['shine', 'breakouts', 'dark_spots', 'redness', 'dryness', 'under_eye'] as const;
export const productSteps = ['cleanser', 'treatment', 'moisturiser', 'sunscreen'] as const;
export const quizSchema = z.object({
  skinFeel: z.enum(['oily', 'combination', 'normal', 'dry']), mainConcern: z.enum(concernKeys), budget: z.enum(['under400', '400to800', '800plus']),
  sensitivities: z.array(z.enum(['fragrance', 'pregnant', 'none'])).min(1).max(2),
  redFlags: z.array(z.string().max(60)).max(4).optional(),
}).strict().refine(q => !(q.sensitivities.includes('none') && q.sensitivities.length > 1), 'Choose none or specific sensitivities.');
export const forbiddenCosmeticText = /\b(acne\s*vulgaris|rosacea|melasma|eczema|psoriasis|fungal\s*infection|skin\s*cancer|cancer|carcinoma|dermatitis|diagnos\w*|fair|fairness|whiten\w*|lighten\w*|skin\s*colour|skin\s*color|ethnic\w*|attractive\w*)\b/i;
export const forbiddenProductText = /\b(tretinoin|hydroquinone|clobetasol|betamethasone|hydrocortisone|antibiotic|steroid|whitening|fairness|lightening)\b/i;
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin'); if (!origin || origin === 'null') return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
export function validateImage(value: unknown): { data: string; bytes: Uint8Array } | null {
  if (typeof value !== 'string' || value.length > 2_200_000) return null;
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/.exec(value); if (!match || match[1].length < 100) return null;
  try {
    const raw = atob(match[1]); const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    if (bytes.length > 1_650_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
    let width = 0, height = 0;
    for (let i = 2; i + 9 < bytes.length;) {
      if (bytes[i] !== 0xff) break; const marker = bytes[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const length = (bytes[i + 2] << 8) + bytes[i + 3]; if (length < 2) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker)) { height = (bytes[i + 5] << 8) + bytes[i + 6]; width = (bytes[i + 7] << 8) + bytes[i + 8]; break; }
      i += 2 + length;
    }
    if (width < 150 || height < 150 || width > 1600 || height > 1600) return null;
    return { data: match[1], bytes };
  } catch { return null; }
}
export function safeProductUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 1800) return null;
  try {
    const url = new URL(value);
    const allowed = ['beminimalist.co','thedermaco.com','dotandkey.com','aqualogica.in','plumgoodness.com','simplekindtoskin.in','simpleskincare.in','cetaphil.in','bioderma-india.in','bioderma.in','reequil.com','formularx.com','foxtale.in','consciouschemist.com','deconstruct.in','thedeconstruct.in','nykaa.com','amazon.in','ceraveindia.com','cerave.com','fixderma.com','fixderma.in','sebamedindia.com','simple.co.uk','simple.in','beautyofjoseon.com','isntree.com','suganda.co','earthrhythm.com','drsheths.com'];
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowed.some(d => url.hostname === d || url.hostname.endsWith('.' + d))) return null;
    return url.href;
  } catch { return null; }
}
export const productSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,80}$/), name: z.string().min(2).max(160), brand: z.string().min(1).max(80), step: z.enum(productSteps), priceInr: z.number().positive().max(25000), size: z.string().min(1).max(40),
  ingredients: z.array(z.string().min(1).max(80)).max(20), concerns: z.array(z.enum(concernKeys)).max(6), skinTypes: z.array(z.enum(['oily','combination','normal','dry'])).min(1).max(4),
  fragranceFree: z.boolean(), pregnancyCaution: z.boolean(), budgetBand: z.enum(['under400','400to800','800plus']), url: z.string().refine(v => !!safeProductUrl(v), 'Use an approved HTTPS product store.'),
  affiliateUrl: z.string().refine(v => !v || !!safeProductUrl(v)).optional(), active: z.boolean(), spf: z.number().int().min(1).max(100).optional(), hasActive: z.boolean(), priceCheckedAt: z.string().max(30), priceNote: z.string().max(250), description: z.string().max(500),
}).strict().refine(p => !forbiddenProductText.test(JSON.stringify(p)), 'Prescription and fairness products are not permitted.')
.refine(p => p.step !== 'sunscreen' || (p.spf !== undefined && p.spf >= 30), 'Sunscreens need SPF 30 or greater.')
.refine(p => p.budgetBand === (p.priceInr < 400 ? 'under400' : p.priceInr <= 800 ? '400to800' : '800plus'), 'Budget band must match price.');
