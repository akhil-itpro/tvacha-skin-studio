import { CONCERN_META, PRODUCTS, RULES } from "./catalog";
import { containsRestrictedProductLanguage, isSafeProduct } from "./safety";
import {
  CONCERN_KEYS,
  type ConcernComparison,
  type ConcernKey,
  type FocusArea,
  type Product,
  type ProductStep,
  type QuizAnswers,
  type RoutinePlan,
  type RoutineStep,
  type ShelfItem,
  type SkinAnalysis,
} from "./types";

export type IngredientRules = typeof RULES;

export function getFocusAreas(
  quiz: QuizAnswers,
  analysis: SkinAnalysis | null,
  ingredientRules: IngredientRules = RULES,
): FocusArea[] {
  const measured = analysis?.image_ok
    ? analysis.concerns
        .filter((concern) => concern.level > 0 && concern.confidence !== "low")
        .sort(
          (a, b) =>
            b.level - a.level ||
            Number(b.key === quiz.mainConcern) -
              Number(a.key === quiz.mainConcern) ||
            CONCERN_KEYS.indexOf(a.key) - CONCERN_KEYS.indexOf(b.key),
        )
        .slice(0, 3)
    : null;
  const keys = measured
    ? measured.map((concern) => concern.key)
    : [quiz.mainConcern];
  return keys.map((key) => ({
    key,
    title: CONCERN_META[key].name,
    explanation: ingredientRules[key].notes,
    ingredients: [...ingredientRules[key].ingredients],
    ...(measured
      ? {
          confidence: measured.find((concern) => concern.key === key)!
            .confidence,
        }
      : {}),
  }));
}

function budgetCap(quiz: QuizAnswers): number {
  return quiz.budget === "under400"
    ? 399.99
    : quiz.budget === "400to800"
      ? 800
      : Infinity;
}

/** Recommendations are deterministic. No AI, commission rate or click history enters ranking. */
export function buildRoutine(
  quiz: QuizAnswers,
  analysis: SkinAnalysis | null = null,
  shelf: ShelfItem[] = [],
  products: Product[] = PRODUCTS,
  ingredientRules: IngredientRules = RULES,
): RoutinePlan {
  const empty: RoutinePlan = {
    am: [],
    pm: [],
    focusAreas: [],
    ingredients: [],
    products: [],
    notes: [],
    source: "quiz",
    stopped: true,
  };
  if (quiz.redFlags?.length)
    return {
      ...empty,
      notes: [
        "Please see a dermatologist. A photo and product routine cannot explain a painful, spreading, bleeding or changing area.",
      ],
    };
  const focusAreas = getFocusAreas(quiz, analysis, ingredientRules);
  const focusKeys = focusAreas.map((area) => area.key);
  const pregnant = quiz.sensitivities.includes("pregnant");
  const gentleOnly = pregnant || focusKeys.includes("redness");
  const fragranceFree =
    quiz.sensitivities.includes("fragrance") || focusKeys.includes("redness");
  const safeShelf = shelf.filter(
    (item) => !containsRestrictedProductLanguage(item.name),
  );
  // An owned prescription still matters for avoiding an extra active, even though
  // it is never endorsed as a step in this cosmetic-only routine.
  const shelfActive = shelf.some(
    (item) =>
      item.hasActive ||
      item.step === "treatment" ||
      products.find((product) => product.id === item.productId)?.hasActive,
  );
  const notes = [
    "Patch test a new product for 24–48 hours. Introduce one new active at a time and stop if irritation occurs.",
    "Reference prices can change. Read the current pack ingredients and directions before buying.",
  ];
  if (pregnant)
    notes.push(
      "Pregnant or breastfeeding: check with your doctor before adding products. We have skipped new active treatments and products with brand pregnancy cautions.",
    );
  if (
    analysis &&
    analysis.concerns.some((concern) => concern.confidence === "low")
  )
    notes.push(
      "We couldn't read some areas well. We have left low-confidence photo estimates out of your focus areas.",
    );
  if (focusKeys.includes("under_eye"))
    notes.push(
      "Under-eye darkness varies with light and sleep. Keep sunscreen away from eyes; no dedicated eye product is needed here.",
    );
  if (shelfActive)
    notes.push(
      "Your shelf already contains an active step. No additional active is suggested. Check combinations with a dermatologist if unsure.",
    );
  if (safeShelf.length < shelf.length)
    notes.push(
      "Some shelf items need professional advice. We have left them out of the cosmetic routine.",
    );
  if (focusKeys.includes("redness"))
    notes.push(
      "Keep to fragrance-free essentials while skin feels irritated. Pause new active products.",
    );

  const eligible = products.filter(
    (product) =>
      isSafeProduct(product) &&
      product.priceInr <= budgetCap(quiz) &&
      product.skinTypes.includes(quiz.skinFeel) &&
      (!fragranceFree || product.fragranceFree) &&
      (!pregnant || (!product.pregnancyCaution && !product.hasActive)) &&
      (product.step !== "sunscreen" || (product.spf ?? 0) >= 30),
  );

  const ingredientFit = (product: Product): number =>
    focusAreas.reduce(
      (sum, area, index) =>
        sum +
        area.ingredients.filter((wanted) =>
          product.ingredients.some((ingredient) => {
            const a = wanted.toLowerCase().trim(),
              b = ingredient.toLowerCase().trim();
            return (
              a === b ||
              (a.length > 3 && b.includes(a)) ||
              (b.length > 3 && a.includes(b))
            );
          }),
        ).length *
          (3 - index),
      0,
    );
  const rank = (step: ProductStep, allowActive = false): Product[] =>
    eligible
      .filter(
        (product) =>
          product.step === step &&
          (allowActive || !product.hasActive) &&
          (step !== "treatment" || ingredientFit(product) > 0),
      )
      .map((product) => ({
        product,
        score:
          focusKeys.reduce(
            (sum, key, index) =>
              sum + (product.concerns.includes(key) ? (3 - index) * 6 : 0),
            0,
          ) +
          ingredientFit(product) * 3 +
          (product.budgetBand === quiz.budget ? 3 : 0) +
          (product.fragranceFree ? 1 : 0) -
          // A higher concentration is not a better beginner product.
          (product.step === "treatment" && /10%/.test(product.name) ? 4 : 0),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.product.priceInr - b.product.priceInr ||
          a.product.id.localeCompare(b.product.id),
      )
      .map((item) => item.product);

  const titles: Record<ProductStep, string> = {
    cleanser: "Cleanse gently",
    treatment: "One optional active",
    moisturiser: "Keep moisture in",
    sunscreen: "Sunscreen, always",
  };
  const instructions: Record<ProductStep, string> = {
    cleanser: "Wash gently with lukewarm water. No scrubbing. Pat dry.",
    treatment:
      "Optional. Patch test first, then introduce slowly on a few evenings. Follow the pack directions.",
    moisturiser:
      "Apply after cleansing, while skin is slightly damp. Use enough to feel comfortable.",
    sunscreen:
      "Use broad-spectrum SPF 30+ generously on exposed skin. Follow the pack directions and reapply during sun exposure, after swimming or sweating.",
  };

  function step(key: ProductStep, optional = false): RoutineStep {
    const owned = safeShelf.find((item) => {
      if (item.step !== key) return false;
      const known = products.find((product) => product.id === item.productId);
      if (
        (pregnant || gentleOnly) &&
        (item.hasActive || known?.hasActive || key === "treatment")
      )
        return false;
      if (pregnant && known?.pregnancyCaution) return false;
      if (fragranceFree && known && !known.fragranceFree) return false;
      // Unverified custom products cannot be assumed to meet a sensitivity restriction.
      if ((pregnant || fragranceFree) && !known) return false;
      return key !== "sunscreen" || !known || (known.spf ?? 0) >= 30;
    });
    if (owned) {
      const known = products.find((product) => product.id === owned.productId);
      if (
        (!pregnant || !known?.pregnancyCaution) &&
        (!fragranceFree || !known || known.fragranceFree)
      ) {
        return {
          key,
          title: titles[key],
          instruction:
            key === "sunscreen"
              ? `Use your own sunscreen only if it is broad-spectrum SPF 30+. ${instructions[key]}`
              : instructions[key],
          product: null,
          owned: true,
          ownedName: owned.name,
          optional,
        };
      }
    }
    const choices = rank(key, key === "treatment");
    const chosen = choices[0] ?? null;
    const alternatives = choices
      .filter((product) => chosen && product.id !== chosen.id && product.priceInr < chosen.priceInr)
      .sort((a, b) => a.priceInr - b.priceInr || a.id.localeCompare(b.id))
      .slice(0, 2);
    let budgetNote: string | undefined;
    if (!chosen)
      budgetNote =
        "No suitable catalogue option within your budget. Look for this step locally or ask a pharmacist; do not stretch your budget.";
    else if (chosen.budgetBand !== quiz.budget)
      budgetNote =
        "A suitable option below your budget band. Spending more is optional.";
    return {
      key,
      title: titles[key],
      instruction: instructions[key],
      product: chosen,
      owned: false,
      optional,
      budgetNote,
      alternatives,
    };
  }

  const cleanser = step("cleanser");
  const moisturiser = step("moisturiser");
  const sunscreen = step("sunscreen");
  const am = [cleanser, moisturiser, sunscreen];
  const pm = [cleanser, moisturiser];
  const activeRelevant = focusKeys.some((key) =>
    ["shine", "breakouts", "dark_spots"].includes(key),
  );
  if (
    !gentleOnly &&
    (activeRelevant || safeShelf.some((item) => item.step === "treatment"))
  ) {
    if (!shelfActive || safeShelf.some((item) => item.step === "treatment")) {
      const treatment = step("treatment", true);
      if (treatment.product || treatment.owned) pm.splice(1, 0, treatment);
    }
  }
  if (!sunscreen.product && !sunscreen.owned)
    notes.push(
      "Sunscreen is still part of your routine. We could not match a suitable one within this budget; ask your doctor or pharmacist for help choosing.",
    );
  const chosenProducts = [
    ...new Map(
      [...am, ...pm]
        .filter((item) => item.product)
        .map((item) => [item.product!.id, item.product!]),
    ).values(),
  ];
  const ingredients = [
    ...new Set([
      "sunscreen",
      ...focusAreas.flatMap((area) => area.ingredients),
    ]),
  ];
  return {
    am,
    pm,
    focusAreas,
    ingredients,
    products: chosenProducts,
    notes,
    source: analysis?.image_ok ? "photo" : "quiz",
    stopped: false,
  };
}

export function compareAnalyses(
  newest: SkinAnalysis,
  previous: SkinAnalysis,
): ConcernComparison[] {
  return CONCERN_KEYS.map((key) => {
    const current = newest.concerns.find((concern) => concern.key === key);
    const past = previous.concerns.find((concern) => concern.key === key);
    if (
      !newest.image_ok ||
      !previous.image_ok ||
      !current ||
      !past ||
      current.confidence === "low" ||
      past.confidence === "low"
    )
      return { key, change: "not sure" };
    return {
      key,
      change:
        current.level < past.level
          ? "better"
          : current.level > past.level
            ? "worse"
            : "same",
    };
  });
}

export function daysUntilRescan(
  lastScanAt: string | null,
  now = new Date(),
): number {
  if (!lastScanAt) return 0;
  const timestamp = new Date(lastScanAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(
    0,
    Math.min(7, 7 - Math.floor((now.getTime() - timestamp) / 86400000)),
  );
}
