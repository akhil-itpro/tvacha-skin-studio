import type { ConcernKey, Product, SkinFeel } from './types';

export const CONCERN_META: Record<ConcernKey, { name: string; code: string; color: string; description: string }> = {
  shine: { name: 'Shine', code: 'S', color: '#B17A3B', description: 'Visible surface shine, especially through the T-zone.' },
  breakouts: { name: 'Breakouts', code: 'B', color: '#E01C7D', description: 'The appearance of small bumps and blemishes.' },
  dark_spots: { name: 'Uneven tone', code: 'D', color: '#7D540E', description: 'Visible dark spots or areas of uneven tone.' },
  redness: { name: 'Redness', code: 'R', color: '#750E15', description: 'Visible areas of redness. A photo cannot explain their cause.' },
  dryness: { name: 'Dryness', code: 'Y', color: '#1670E3', description: 'Visible flaky or dry-looking patches.' },
  under_eye: { name: 'Under-eye', code: 'U', color: '#3E266C', description: 'The appearance of darkness beneath the eyes.' },
};

export const RULES: Record<ConcernKey, { ingredients: string[]; notes: string }> = {
  shine: { ingredients: ['niacinamide'], notes: 'A gentle cleanse and light moisturiser are a useful starting point. Add one active at a time.' },
  breakouts: { ingredients: ['niacinamide', 'salicylic acid', 'zinc'], notes: 'Keep the routine simple. Avoid scrubbing or picking. Painful or persistent changes need a dermatologist.' },
  dark_spots: { ingredients: ['sunscreen', 'niacinamide', 'vitamin C', 'alpha arbutin'], notes: 'Sunscreen comes first. A photo cannot tell us why a dark spot appeared.' },
  redness: { ingredients: ['ceramides', 'centella', 'glycerin'], notes: 'Choose fragrance-free care and avoid adding an exfoliating active while skin feels irritated.' },
  dryness: { ingredients: ['ceramides', 'glycerin', 'hyaluronic acid'], notes: 'Use a gentle cleanser and moisturise after washing. Persistent discomfort deserves professional advice.' },
  under_eye: { ingredients: ['sunscreen'], notes: 'Sleep, shadows and light can affect this area. No eye-cream promises. Keep products away from the eyes.' },
};

const ALL: SkinFeel[] = ['oily', 'combination', 'normal', 'dry'];
const DRY: SkinFeel[] = ['normal', 'dry'];
const OILY: SkinFeel[] = ['oily', 'combination', 'normal'];
const PRICE_DATE = '2026-10-24';
const PRICE_NOTE = 'Reference list price checked 24 Oct 2026. Prices and availability can change; confirm at the store.';

type Seed = Pick<Product, 'id' | 'name' | 'brand' | 'step' | 'priceInr' | 'size' | 'ingredients' | 'concerns' | 'skinTypes' | 'url' | 'description'> & Partial<Pick<Product, 'fragranceFree' | 'pregnancyCaution' | 'spf' | 'hasActive'>>;
function product(seed: Seed): Product {
  return {
    fragranceFree: true, pregnancyCaution: false, hasActive: seed.step === 'treatment',
    ...seed, budgetBand: seed.priceInr < 400 ? 'under400' : seed.priceInr <= 800 ? '400to800' : '800plus',
    active: true, priceCheckedAt: PRICE_DATE, priceNote: PRICE_NOTE,
  };
}
const minimal = (handle: string) => `https://beminimalist.co/products/${handle}`;
const simple = (handle: string) => `https://www.simpleskincare.in/products/${handle}`;
const reequil = (handle: string) => `https://www.reequil.com/products/${handle}`;

/** Seeded from official brand product pages and their public Shopify product feeds.
 * Prices are reference list prices, deliberately excluding temporary discounts.
 * No commercial relationship is implied. affiliateUrl is absent until the founder configures it.
 */
export const PRODUCTS: Product[] = [
  product({ id: 'minimalist-oat-cleanser', name: 'B12 + Oat Extract 6.5% Gentle Cleanser', brand: 'Minimalist', step: 'cleanser', priceInr: 299, size: '120 ml', ingredients: ['oat extract', 'glycerin', 'panthenol'], concerns: ['dryness', 'redness'], skinTypes: ALL, url: minimal('oat-extract-06-gentle-cleanser'), description: 'A mild, low-foam cleanser for a simple daily cleanse.' }),
  product({ id: 'minimalist-aquaporin-cleanser', name: 'Aquaporin Booster 5% Cleanser', brand: 'Minimalist', step: 'cleanser', priceInr: 299, size: '100 ml', ingredients: ['glycerin', 'glyceryl glucoside', 'panthenol'], concerns: ['dryness'], skinTypes: DRY, url: minimal('aquaporin-booster-05-cleanser'), description: 'A hydrating cleanser for skin that feels tight after washing.' }),
  product({ id: 'minimalist-salicylic-cleanser', name: 'Salicylic Acid + LHA 2% Cleanser', brand: 'Minimalist', step: 'cleanser', priceInr: 299, size: '100 ml', ingredients: ['salicylic acid', 'glycerin', 'panthenol'], concerns: ['shine', 'breakouts'], skinTypes: OILY, url: minimal('salicylic-lha-2-cleanser'), description: 'An exfoliating cleanser. Introduce slowly and avoid other new actives.', hasActive: true, pregnancyCaution: true }),
  product({ id: 'minimalist-niacinamide5-mini', name: 'Niacinamide 5% Face Serum', brand: 'Minimalist', step: 'treatment', priceInr: 249, size: '10 ml', ingredients: ['niacinamide', 'oat extract', 'hyaluronic acid'], concerns: ['shine', 'breakouts', 'dark_spots'], skinTypes: ALL, url: minimal('niacinamide-5-face-serum-10ml'), description: 'A smaller-size niacinamide option for a gradual introduction.' }),
  product({ id: 'minimalist-niacinamide5', name: 'Niacinamide 5% Face Serum', brand: 'Minimalist', step: 'treatment', priceInr: 599, size: '30 ml', ingredients: ['niacinamide', 'oat extract', 'hyaluronic acid'], concerns: ['shine', 'breakouts', 'dark_spots'], skinTypes: ALL, url: minimal('niacinamide-5-hyaluronic-acid-1'), description: 'A niacinamide serum for the appearance of shine and uneven tone.' }),
  product({ id: 'minimalist-niacinamide10-large', name: 'Niacinamide 10% Face Serum', brand: 'Minimalist', step: 'treatment', priceInr: 999, size: '60 ml', ingredients: ['niacinamide', 'zinc PCA', 'glycerin'], concerns: ['shine', 'breakouts', 'dark_spots'], skinTypes: OILY, url: minimal('niacinamide-10-with-matmarine'), description: 'A larger bottle of a stronger niacinamide formula. More is not automatically better.' }),
  product({ id: 'minimalist-b5-moisturiser', name: 'Vitamin B5 10% Moisturizer', brand: 'Minimalist', step: 'moisturiser', priceInr: 349, size: '50 g', ingredients: ['panthenol', 'glycerin', 'hyaluronic acid'], concerns: ['dryness', 'shine'], skinTypes: OILY, url: minimal('vitamin-b5-10-moisturizer'), description: 'A lightweight moisturiser suited to oily or combination skin.' }),
  product({ id: 'minimalist-ceramide-moisturiser', name: 'Ceramides 0.3% + Madecassoside Moisturizer', brand: 'Minimalist', step: 'moisturiser', priceInr: 599, size: '50 g', ingredients: ['ceramides', 'madecassoside', 'glycerin'], concerns: ['redness', 'dryness'], skinTypes: ALL, url: minimal('ceramides-0-3-madecassoside'), description: 'Fragrance-free moisturising care with ceramides and madecassoside.' }),
  product({ id: 'minimalist-spf50', name: 'SPF 50 Sunscreen', brand: 'Minimalist', step: 'sunscreen', priceInr: 399, size: '50 g', ingredients: ['UV filters', 'niacinamide', 'panthenol'], concerns: ['dark_spots', 'under_eye'], skinTypes: ALL, url: minimal('multi-vitamin-spf-50'), description: 'Broad-spectrum SPF 50 PA++++. The brand advises against use during pregnancy or breastfeeding.', spf: 50, pregnancyCaution: true }),
  product({ id: 'minimalist-fluid-spf50-mini', name: 'Light Fluid SPF 50 Sunscreen', brand: 'Minimalist', step: 'sunscreen', priceInr: 349, size: '30 ml', ingredients: ['UV filters'], concerns: ['shine', 'dark_spots', 'under_eye'], skinTypes: ALL, url: minimal('light-fluid-spf-50-sunscreen'), description: 'A light fluid sunscreen. The brand advises against use during pregnancy or breastfeeding.', spf: 50, pregnancyCaution: true }),
  product({ id: 'minimalist-fluid-spf50', name: 'Light Fluid SPF 50 Sunscreen', brand: 'Minimalist', step: 'sunscreen', priceInr: 499, size: '50 ml', ingredients: ['UV filters'], concerns: ['shine', 'dark_spots', 'under_eye'], skinTypes: ALL, url: minimal('light-fluid-spf-50-sunscreen'), description: 'A light fluid sunscreen. The brand advises against use during pregnancy or breastfeeding.', spf: 50, pregnancyCaution: true }),
  product({ id: 'minimalist-fluid-spf50-large', name: 'Light Fluid SPF 50 Sunscreen', brand: 'Minimalist', step: 'sunscreen', priceInr: 899, size: '100 ml', ingredients: ['UV filters'], concerns: ['shine', 'dark_spots', 'under_eye'], skinTypes: ALL, url: minimal('light-fluid-spf-50-sunscreen'), description: 'A larger bottle of the same fluid. The brand advises against use during pregnancy or breastfeeding.', spf: 50, pregnancyCaution: true }),
  product({ id: 'simple-refreshing-cleanser', name: 'Refreshing Facial Wash', brand: 'Simple', step: 'cleanser', priceInr: 299, size: '100 ml', ingredients: ['pro-vitamin B5', 'vitamin E'], concerns: ['shine'], skinTypes: ALL, url: simple('simple-kind-to-skin-refreshing-facial-wash-100-ml'), description: 'A soap-free wash with no added perfume.' }),
  product({ id: 'simple-moisturising-cleanser', name: 'Moisturising Facial Wash', brand: 'Simple', step: 'cleanser', priceInr: 299, size: '100 ml', ingredients: ['pro-vitamin B5', 'vitamin E', 'bisabolol'], concerns: ['dryness', 'redness'], skinTypes: DRY, url: simple('simple-moisturising-facial-wash-100ml'), description: 'A perfume-free daily wash for normal to dry skin.' }),
  product({ id: 'simple-light-moisturiser-mini', name: 'Hydrating Light Moisturiser', brand: 'Simple', step: 'moisturiser', priceInr: 249, size: '50 ml', ingredients: ['pro-vitamin B5', 'vitamin E', 'borage seed oil'], concerns: ['dryness'], skinTypes: ALL, url: simple('simple-hydrating-light-moisturiser-50ml'), description: 'A light, perfume-free moisturiser in a smaller bottle.' }),
  product({ id: 'simple-light-moisturiser', name: 'Hydrating Light Moisturiser', brand: 'Simple', step: 'moisturiser', priceInr: 499, size: '125 ml', ingredients: ['pro-vitamin B5', 'vitamin E', 'borage seed oil'], concerns: ['dryness'], skinTypes: ALL, url: simple('hydrating-light-moisturiser-with-borage-seed-oil-pro-vit-b5-vit-e-125-ml'), description: 'A perfume-free everyday moisturiser with a light texture.' }),
  product({ id: 'simple-rich-moisturiser', name: 'Replenishing Rich Moisturiser', brand: 'Simple', step: 'moisturiser', priceInr: 499, size: '125 ml', ingredients: ['glycerin', 'allantoin', 'pro-vitamin B5'], concerns: ['dryness', 'redness'], skinTypes: DRY, url: simple('replenishing-rich-moisturiser-with-glycerin-pro-vit-b5-125ml'), description: 'A richer moisturising option for normal to dry skin.' }),
  product({ id: 'simple-niacinamide-mini', name: 'Booster Serum 10% Niacinamide', brand: 'Simple', step: 'treatment', priceInr: 399, size: '15 ml', ingredients: ['niacinamide'], concerns: ['shine', 'dark_spots', 'breakouts'], skinTypes: OILY, url: simple('10-niacinamide-booster-serum-15ml'), description: 'A concentrated niacinamide serum. Begin with a small amount.' }),
  product({ id: 'simple-mattifying-spf50', name: 'Mattifying UV Fluid SPF 50 PA++++', brand: 'Simple', step: 'sunscreen', priceInr: 499, size: '40 ml', ingredients: ['UV filters', 'niacinamide'], concerns: ['shine', 'dark_spots', 'under_eye'], skinTypes: ALL, url: simple('simple-mattifying-uv-fluid-spf-50-pa-with-niacinamide-sunscreen-for-oily-sensitive-skin'), description: 'A lightweight, perfume-free broad-spectrum sunscreen.', spf: 50 }),
  product({ id: 'simple-hyaluronic-serum', name: '2% Hyaluronic Acid + Polyglutamic Acid Booster Serum', brand: 'Simple', step: 'treatment', priceInr: 599, size: '30 ml', ingredients: ['hyaluronic acid', 'polyglutamic acid'], concerns: ['dryness'], skinTypes: ALL, url: simple('simple-2-hyaluronic-acid-polyglutamic-acid-booster-serum'), description: 'Optional hydration. A moisturiser may already cover this need.' }),
  product({ id: 'reequil-ceramide-moisturiser', name: 'Ceramide & Hyaluronic Acid Moisturiser', brand: "Re'equil", step: 'moisturiser', priceInr: 295, size: '100 g', ingredients: ['ceramides', 'hyaluronic acid'], concerns: ['dryness'], skinTypes: DRY, url: reequil('ceramide-hyaluronic-acid-moisturiser-for-normal-to-dry-skin'), description: 'A richer moisturiser. Contains fragrance; skip if fragrance bothers your skin.', fragranceFree: false }),
  product({ id: 'reequil-gentle-cleanser', name: 'Hydrating & Soothing Gentle Cleanser', brand: "Re'equil", step: 'cleanser', priceInr: 425, size: '150 ml', ingredients: ['glycerin', 'panthenol', 'ceramides'], concerns: ['dryness', 'redness'], skinTypes: DRY, url: reequil('hydrating-soothing-gentle-cleanser'), description: 'A fragrance-free, low-foam daily cleanser.' }),
  product({ id: 'reequil-ultramatte-spf50', name: 'Ultra Matte Dry Touch Sunscreen SPF 50 PA++++', brand: "Re'equil", step: 'sunscreen', priceInr: 645, size: '50 g', ingredients: ['UV filters', 'zinc oxide', 'titanium dioxide'], concerns: ['shine', 'dark_spots', 'under_eye'], skinTypes: OILY, url: reequil('ultra-matte-dry-touch-sunscreen-gel-spf-50-pa'), description: 'A matte-finish sunscreen. Contains fragrance.', fragranceFree: false, pregnancyCaution: true, spf: 50 }),
  product({ id: 'reequil-aquagel-spf50', name: 'Oil-Free Aquagel Sunscreen SPF 50+', brand: "Re'equil", step: 'sunscreen', priceInr: 545, size: '50 ml', ingredients: ['UV filters', 'glycerin', 'hyaluronic acid'], concerns: ['shine', 'dark_spots', 'under_eye'], skinTypes: ALL, url: reequil('oil-free-aqua-gel-sunscreen'), description: 'An aqua-gel texture sunscreen. Contains fragrance.', fragranceFree: false, spf: 50 }),
];

export const CATALOGUE_NOTE = 'Independent picks from official brand catalogues. Reference prices, not live offers. Always check the current pack ingredients and store price.';
