import { env } from "cloudflare:workers";
import { z, ZodError } from "zod";
import { PRODUCTS, RULES } from "@/src/domain/catalog";
import {
  buildRoutine,
  type IngredientRules,
} from "@/src/domain/recommendations";
import {
  validateProduct,
  containsForbiddenLanguage,
} from "@/src/domain/safety";
import type { Product, ShelfItem, QuizAnswers } from "@/src/domain/types";
import { analysePhoto, analysisConfiguration } from "./analysis";
import { reserveScan } from "./quota";
import {
  INSERT_SCAN_GUARDED,
  INSERT_EVENT_FOR_SCAN,
  UPSERT_PROFILE,
} from "./guards";
import {
  body,
  db,
  owner,
  json,
  event,
  id,
  now,
  isAdmin,
  requireAdmin,
  latestConsents,
  deletePhotos,
  deleteAccount,
  HttpError,
  PROFILE_GENERATION_EXISTS,
  generationArgs,
  requireWrite,
  type Owner,
} from "./core";
import {
  quizSchema,
  productSteps,
  productSchema,
  validateImage,
  safeProductUrl,
  concernKeys,
  validRoutineDate,
} from "./validation";

type Row = Record<string, unknown>;
function parse<T>(value: unknown): T | null {
  try {
    return typeof value === "string" ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
function scan(row: Row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    quiz: parse<QuizAnswers>(row.quiz_json),
    analysis: parse(row.result_json),
    source: row.source,
    message: row.message,
    model: row.model,
  };
}
async function catalog(includeInactive = false): Promise<Product[]> {
  let rows = await db()
    .prepare("SELECT data_json, active FROM products ORDER BY id")
    .all<{ data_json: string; active: number }>();
  if (!rows.results.length) {
    await db().batch([
      ...PRODUCTS.map((p) =>
        db()
          .prepare(
            "INSERT OR IGNORE INTO products (id,data_json,active,updated_at) VALUES (?,?,?,?)",
          )
          .bind(p.id, JSON.stringify(p), p.active ? 1 : 0, now()),
      ),
      ...Object.entries(RULES).map(([concern, rule]) =>
        db()
          .prepare(
            "INSERT OR IGNORE INTO rules (concern,data_json) VALUES (?,?)",
          )
          .bind(concern, JSON.stringify(rule)),
      ),
      db().prepare(
        "INSERT OR IGNORE INTO settings (key,value) VALUES ('daily_scan_cap','20')",
      ),
    ]);
    rows = await db()
      .prepare("SELECT data_json, active FROM products ORDER BY id")
      .all<{ data_json: string; active: number }>();
  }
  return rows.results
    .filter((r) => includeInactive || r.active === 1)
    .map((r) => parse<Product>(r.data_json))
    .filter((p): p is Product => !!p);
}
async function shelfFor(ownerId: string): Promise<ShelfItem[]> {
  const rows = await db()
    .prepare(
      "SELECT id,name,step,product_id,has_active FROM shelf_items WHERE owner_id = ? ORDER BY created_at DESC",
    )
    .bind(ownerId)
    .all<Row>();
  return rows.results.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    step: r.step as ShelfItem["step"],
    productId: r.product_id ? String(r.product_id) : undefined,
    hasActive: r.has_active === 1,
  }));
}
async function ingredientRules(): Promise<IngredientRules> {
  const rows = await db()
    .prepare("SELECT concern,data_json FROM rules")
    .all<{ concern: string; data_json: string }>();
  const result = structuredClone(RULES);
  const ruleSchema = z
    .object({
      ingredients: z.array(z.string().min(1).max(80)).min(1).max(12),
      notes: z.string().min(1).max(600),
    })
    .strict();
  for (const row of rows.results) {
    if (!concernKeys.includes(row.concern as (typeof concernKeys)[number]))
      continue;
    const parsed = ruleSchema.safeParse(parse(row.data_json));
    if (
      parsed.success &&
      !containsForbiddenLanguage(JSON.stringify(parsed.data))
    )
      result[row.concern as keyof IngredientRules] = parsed.data;
  }
  return result;
}
async function state(current: Owner) {
  const [
    profile,
    consents,
    scans,
    ticks,
    shelf,
    products,
    photos,
    waiting,
    admin,
  ] = await Promise.all([
    db()
      .prepare("SELECT * FROM profiles WHERE owner_id = ?")
      .bind(current.id)
      .first<Row>(),
    latestConsents(current.id),
    db()
      .prepare(
        "SELECT * FROM scans WHERE owner_id = ? ORDER BY created_at DESC LIMIT 200",
      )
      .bind(current.id)
      .all<Row>(),
    db()
      .prepare(
        "SELECT date,slot,step,done FROM routine_ticks WHERE owner_id = ? ORDER BY date DESC LIMIT 800",
      )
      .bind(current.id)
      .all<Row>(),
    shelfFor(current.id),
    catalog(),
    db()
      .prepare(
        "SELECT id,scan_id,created_at FROM progress_photos WHERE owner_id = ? ORDER BY created_at DESC LIMIT 200",
      )
      .bind(current.id)
      .all<Row>(),
    db()
      .prepare("SELECT owner_id FROM waitlist WHERE owner_id = ?")
      .bind(current.id)
      .first(),
    isAdmin(current),
  ]);
  if (profile?.age_confirmed === 1)
    current.generation = String(profile.created_at);
  const invite = await db()
    .prepare("SELECT code FROM invites WHERE owner_id = ?")
    .bind(current.id)
    .first<{ code: string }>();
  if (!current.isGuest && invite) await ensureInvite(current);
  return {
    user: {
      id: current.id,
      email: current.email,
      name: current.name,
      isGuest: current.isGuest,
    },
    inviteCode: invite?.code || null,
    profile: profile
      ? {
          ageConfirmed: profile.age_confirmed === 1,
          quiz: parse(profile.quiz_json),
          createdAt: profile.created_at,
        }
      : null,
    consents,
    scans: scans.results.map(scan),
    ticks: ticks.results.map((t) => ({ ...t, done: t.done === 1 })),
    shelf,
    products,
    rules: await ingredientRules(),
    photos: photos.results.map((p) => ({
      id: p.id,
      scanId: p.scan_id,
      createdAt: p.created_at,
    })),
    waitlist: !!waiting,
    isAdmin: admin,
    services: {
      photoAnalysis: analysisConfiguration(env).ready,
      photoStorage: !!env.BUCKET,
      photoProvider: analysisConfiguration(env).name,
      photoModel: analysisConfiguration(env).model,
      photoAnalysisReason: analysisConfiguration(env).reason,
    },
  };
}

async function saveProfile(request: Request, current: Owner) {
  const data = z
    .object({ ageConfirmed: z.literal(true), quiz: quizSchema.optional() })
    .strict()
    .parse(await body(request));
  requireWrite(
    await db()
      .prepare(UPSERT_PROFILE)
      .bind(current.id, now(), data.quiz ? JSON.stringify(data.quiz) : null)
      .run(),
  );
  current.generation = (
    await db()
      .prepare("SELECT created_at FROM profiles WHERE owner_id = ?")
      .bind(current.id)
      .first<{ created_at: string }>()
  )?.created_at;
  if (!current.generation)
    throw new HttpError(
      409,
      "Your data changed during age confirmation. Please try again.",
    );
  await event(current, "age_confirmed");
  if (data.quiz?.redFlags?.length) await event(current, "red_flag_stop");
  return { ok: true };
}
async function saveConsents(request: Request, current: Owner) {
  const data = z
    .object({ analysis: z.boolean(), progressPhotos: z.boolean().optional() })
    .strict()
    .parse(await body(request));
  const timestamp = now();
  const version = "2026-10-25:" + analysisConfiguration(env).provider;
  const statements = [
    db()
      .prepare(
        `INSERT INTO consents (id,owner_id,purpose,granted,version,created_at) SELECT ?,?,?,?,?,? WHERE ${PROFILE_GENERATION_EXISTS}`,
      )
      .bind(
        id(),
        current.id,
        "analysis",
        data.analysis ? 1 : 0,
        version,
        timestamp,
        ...generationArgs(current),
      ),
  ];
  // Omitting the per-check saving choice preserves earlier consent. A stale browser
  // cannot silently re-grant a choice withdrawn in another tab.
  if (data.progressPhotos !== undefined)
    statements.push(
      db()
        .prepare(
          `INSERT INTO consents (id,owner_id,purpose,granted,version,created_at) SELECT ?,?,?,?,?,? WHERE ${PROFILE_GENERATION_EXISTS}`,
        )
        .bind(
          id(),
          current.id,
          "progress_photos",
          data.progressPhotos ? 1 : 0,
          version,
          timestamp,
          ...generationArgs(current),
        ),
    );
  const writes = await db().batch(statements);
  requireWrite(writes[0]);
  if (data.progressPhotos === false) await deletePhotos(current.id);
  await event(current, "consent_given", {
    analysis: data.analysis,
    ...(data.progressPhotos !== undefined
      ? { progressPhotos: data.progressPhotos }
      : {}),
  });
  return { ok: true };
}
async function analyse(request: Request, current: Owner) {
  const data = z
    .object({
      quiz: quizSchema,
      mode: z.enum(["photo", "quiz"]),
      image: z.string().optional(),
    })
    .strict()
    .parse(await body(request, 2_250_000));
  const profile = await db()
    .prepare("SELECT age_confirmed,created_at FROM profiles WHERE owner_id = ?")
    .bind(current.id)
    .first<{ age_confirmed: number; created_at: string }>();
  if (profile?.age_confirmed !== 1)
    throw new HttpError(
      403,
      "Please confirm you are 18 or older before starting.",
    );
  current.generation = profile.created_at;
  if (data.quiz.redFlags?.length) {
    await event(current, "red_flag_stop");
    throw new HttpError(
      422,
      "Please see a dermatologist for symptoms that hurt, spread, change or do not heal. A skin check cannot safely help with these.",
    );
  }
  await db()
    .prepare("UPDATE profiles SET quiz_json = ? WHERE owner_id = ?")
    .bind(JSON.stringify(data.quiz), current.id)
    .run();
  const [shelf, products] = await Promise.all([
    shelfFor(current.id),
    catalog(),
  ]);
  const rules = await ingredientRules();
  let originalConsentId: string | null = null;
  let result: Awaited<ReturnType<typeof analysePhoto>> = {
    analysis: null,
    model: "quiz",
    message: "This routine is based on your answers. No photo was analysed.",
  };
  if (data.mode === "photo") {
    const consent = await latestConsents(current.id);
    if (!consent.analysis)
      throw new HttpError(403, "Please consent to photo analysis first.");
    const originalConsent = await db()
      .prepare(
        "SELECT id,version FROM consents WHERE owner_id = ? AND purpose = 'analysis' ORDER BY created_at DESC, rowid DESC LIMIT 1",
      )
      .bind(current.id)
      .first<{ id: string; version: string }>();
    if (
      analysisConfiguration(env).ready &&
      originalConsent?.version !==
        "2026-10-25:" + analysisConfiguration(env).provider
    )
      throw new HttpError(
        403,
        "The photo provider changed. Please review photo consent again before sending an image.",
      );
    originalConsentId = originalConsent?.id || null;
    const photo = validateImage(data.image);
    if (!photo)
      throw new HttpError(
        400,
        "Use a clear JPEG photo, resized to 1024 pixels.",
      );
    if (analysisConfiguration(env).ready) {
      const day = new Date().toISOString().slice(0, 10),
        capRow = await db()
          .prepare("SELECT value FROM settings WHERE key = 'daily_scan_cap'")
          .first<{ value: string }>();
      const globalCap = Math.min(
        10000,
        Math.max(0, Number(capRow?.value ?? 20) || 0),
      );
      const reservation = await reserveScan(
        db(),
        current.id,
        day,
        now(),
        globalCap,
        current.isGuest ? 1 : 3,
      );
      if (!reservation)
        result = {
          analysis: null,
          model: "quiz",
          message:
            "Today's photo-check limit has been reached. Your routine below is based on your answers.",
        };
      else result = await analysePhoto(photo.data);
    } else result = await analysePhoto(photo.data);
    if (result.analysis && !result.analysis.image_ok) {
      const inserted = await db()
        .prepare(
          "INSERT INTO events (id,owner_id,name,properties,created_at) SELECT ?,?,'retake_needed','{}',? WHERE EXISTS(SELECT 1 FROM profiles WHERE owner_id = ? AND created_at = ?) AND (SELECT id FROM consents WHERE owner_id = ? AND purpose = 'analysis' AND granted = 1 ORDER BY created_at DESC, rowid DESC LIMIT 1) = ? AND (SELECT granted FROM consents WHERE owner_id = ? AND purpose = 'analysis' ORDER BY created_at DESC, rowid DESC LIMIT 1) = 1",
        )
        .bind(
          id(),
          current.id,
          now(),
          current.id,
          profile.created_at,
          current.id,
          originalConsentId,
          current.id,
        )
        .run();
      if (!inserted.meta.changes)
        throw new HttpError(
          409,
          "Your data or consent changed during the check. The photo result was discarded.",
        );
      return {
        retake: true,
        message: result.message,
        retakeReasons: result.analysis.retake_reasons,
        routine: buildRoutine(data.quiz, null, shelf, products, rules),
      };
    }
  }
  const scanId = id(),
    createdAt = now(),
    source = result.analysis ? "photo" : "quiz";
  const insert = db()
    .prepare(INSERT_SCAN_GUARDED)
    .bind(
      scanId,
      current.id,
      createdAt,
      JSON.stringify(data.quiz),
      result.analysis ? JSON.stringify(result.analysis) : null,
      source,
      result.model,
      result.message,
      current.id,
      profile.created_at,
      data.mode,
      current.id,
      originalConsentId,
      current.id,
    );
  const guardedEvent = (
    name: string,
    properties: Record<string, string> = {},
  ) =>
    db()
      .prepare(INSERT_EVENT_FOR_SCAN)
      .bind(
        id(),
        current.id,
        name,
        JSON.stringify(properties),
        createdAt,
        scanId,
        current.id,
      );
  const writes = [insert, guardedEvent("result_viewed", { source })];
  if (data.mode === "photo")
    writes.push(
      guardedEvent(result.analysis ? "analysis_ok" : "analysis_failed"),
    );
  if (result.analysis?.concerns.some((c) => c.confidence === "low"))
    writes.push(guardedEvent("low_confidence"));
  const saved = await db().batch(writes);
  if (!saved[0].meta.changes)
    throw new HttpError(
      409,
      "Your data or consent changed during the check. The photo result was discarded.",
    );
  return {
    scan: {
      id: scanId,
      createdAt,
      quiz: data.quiz,
      analysis: result.analysis,
      source,
      model: result.model,
      message: result.message,
    },
    routine: buildRoutine(data.quiz, result.analysis, shelf, products, rules),
    message: result.message,
  };
}
async function saveTick(request: Request, current: Owner) {
  const data = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: z.enum(["AM", "PM"]),
      step: z.enum(productSteps),
      done: z.boolean(),
    })
    .strict()
    .parse(await body(request));
  if (!validRoutineDate(data.date))
    throw new HttpError(
      400,
      "Choose a real calendar date, today or within the past year.",
    );
  requireWrite(
    await db()
      .prepare(
        `INSERT INTO routine_ticks (id,owner_id,date,slot,step,done) SELECT ?,?,?,?,?,? WHERE ${PROFILE_GENERATION_EXISTS} ON CONFLICT(owner_id,date,slot,step) DO UPDATE SET done=excluded.done`,
      )
      .bind(
        id(),
        current.id,
        data.date,
        data.slot,
        data.step,
        data.done ? 1 : 0,
        ...generationArgs(current),
      )
      .run(),
  );
  return { ok: true };
}
async function modifyShelf(request: Request, current: Owner) {
  const data = await body(request);
  if (request.method === "DELETE") {
    const { id: itemId } = z
      .object({ id: z.string().uuid() })
      .strict()
      .parse(data);
    await db()
      .prepare("DELETE FROM shelf_items WHERE owner_id = ? AND id = ?")
      .bind(current.id, itemId)
      .run();
    return { ok: true };
  }
  const item = z
    .object({
      name: z.string().trim().min(2).max(120),
      step: z.enum(productSteps),
      productId: z.string().max(80).optional(),
      hasActive: z.boolean().optional(),
    })
    .strict()
    .parse(data);
  const count = await db()
    .prepare("SELECT COUNT(*) AS count FROM shelf_items WHERE owner_id = ?")
    .bind(current.id)
    .first<{ count: number }>();
  if ((count?.count ?? 0) >= 50)
    throw new HttpError(
      400,
      "Your shelf can hold 50 products. Remove one before adding another.",
    );
  const matched = item.productId
    ? (await catalog()).find((p) => p.id === item.productId)
    : null;
  if (item.productId && !matched)
    throw new HttpError(400, "That product is no longer in our catalogue.");
  const shelfItem = {
    id: id(),
    name: matched?.name || item.name,
    step: matched?.step || item.step,
    productId: matched?.id,
    hasActive:
      matched?.hasActive ?? (item.hasActive || item.step === "treatment"),
  };
  requireWrite(
    await db()
      .prepare(
        `INSERT INTO shelf_items (id,owner_id,name,step,product_id,has_active,created_at) SELECT ?,?,?,?,?,?,? WHERE ${PROFILE_GENERATION_EXISTS}`,
      )
      .bind(
        shelfItem.id,
        current.id,
        shelfItem.name,
        shelfItem.step,
        shelfItem.productId || null,
        shelfItem.hasActive ? 1 : 0,
        now(),
        ...generationArgs(current),
      )
      .run(),
  );
  return { item: shelfItem };
}
async function photos(request: Request, current: Owner) {
  if (request.method === "GET") {
    const photoId = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("id"));
    const row = await db()
      .prepare(
        "SELECT object_key FROM progress_photos WHERE owner_id = ? AND id = ?",
      )
      .bind(current.id, photoId)
      .first<{ object_key: string }>();
    if (!row || !env.BUCKET) throw new HttpError(404, "Photo not found.");
    const image = await env.BUCKET.get(row.object_key);
    if (!image) throw new HttpError(404, "Photo not found.");
    return new Response(image.body, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (request.method === "DELETE") {
    const data = z
      .object({ id: z.string().uuid() })
      .strict()
      .parse(await body(request));
    await deletePhotos(current.id, data.id);
    return { ok: true };
  }
  if (!env.BUCKET)
    throw new HttpError(503, "Progress-photo storage is not connected yet.");
  const consent = await latestConsents(current.id);
  if (!consent.progressPhotos)
    throw new HttpError(
      403,
      "Turn on progress-photo consent before saving a photo.",
    );
  const originalConsent =
    (
      await db()
        .prepare(
          "SELECT id FROM consents WHERE owner_id = ? AND purpose = 'progress_photos' ORDER BY created_at DESC, rowid DESC LIMIT 1",
        )
        .bind(current.id)
        .first<{ id: string }>()
    )?.id || null;
  const data = z
    .object({ scanId: z.string().uuid(), image: z.string() })
    .strict()
    .parse(await body(request, 2_250_000));
  const check = await db()
    .prepare("SELECT id FROM scans WHERE id = ? AND owner_id = ?")
    .bind(data.scanId, current.id)
    .first();
  if (!check) throw new HttpError(404, "Skin label not found.");
  const photo = validateImage(data.image);
  if (!photo) throw new HttpError(400, "Choose a JPEG photo at 1024 pixels.");
  const count = await db()
    .prepare("SELECT COUNT(*) AS count FROM progress_photos WHERE owner_id = ?")
    .bind(current.id)
    .first<{ count: number }>();
  if ((count?.count ?? 0) >= 100)
    throw new HttpError(
      400,
      "Delete an older progress photo before adding another.",
    );
  const photoId = id(),
    key = `photos/${current.id}/${photoId}.jpg`,
    createdAt = now();
  await env.BUCKET.put(key, photo.bytes, {
    httpMetadata: { contentType: "image/jpeg" },
  });
  try {
    // Consent may have been withdrawn while the object was uploading.
    const inserted = await db()
      .prepare(
        `INSERT INTO progress_photos (id,owner_id,scan_id,object_key,created_at) SELECT ?,?,?,?,? WHERE (SELECT granted FROM consents WHERE owner_id = ? AND purpose = 'progress_photos' ORDER BY created_at DESC, rowid DESC LIMIT 1) = 1 AND (SELECT id FROM consents WHERE owner_id = ? AND purpose = 'progress_photos' ORDER BY created_at DESC, rowid DESC LIMIT 1) = ? AND ${PROFILE_GENERATION_EXISTS} AND EXISTS(SELECT 1 FROM scans WHERE id = ? AND owner_id = ?)`,
      )
      .bind(
        photoId,
        current.id,
        data.scanId,
        key,
        createdAt,
        current.id,
        current.id,
        originalConsent,
        ...generationArgs(current),
        data.scanId,
        current.id,
      )
      .run();
    if (!inserted.meta.changes) {
      await env.BUCKET.delete(key);
      throw new HttpError(
        403,
        "Progress-photo consent was withdrawn. Your photo was not saved.",
      );
    }
  } catch (error) {
    await env.BUCKET.delete(key);
    throw error;
  }
  return { photo: { id: photoId, scanId: data.scanId, createdAt } };
}
async function exportData(current: Owner) {
  const tables = [
    "profiles",
    "consents",
    "scans",
    "routine_ticks",
    "shelf_items",
    "progress_photos",
    "waitlist",
    "invites",
    "referral_signups",
    "events",
  ] as const;
  const entries = await Promise.all(
    tables.map(async (table) => {
      const rows = await db()
        .prepare(`SELECT * FROM ${table} WHERE owner_id = ?`)
        .bind(current.id)
        .all<Row>();
      return [
        table,
        rows.results.map(({ owner_id, object_key, ...row }) => row),
      ] as const;
    }),
  );
  return {
    exportedAt: now(),
    formatVersion: 1,
    user: { id: current.id, email: current.email },
    ...Object.fromEntries(entries),
    note: "Photo metadata is included. Download individual photos from Me before deleting your data.",
  };
}
async function joinWaitlist(request: Request, current: Owner) {
  const data = z
    .object({
      email: z.string().trim().email().max(254),
      price: z.enum(["49", "99", "199", "wouldnt_pay"]).optional(),
      ref: z
        .string()
        .regex(/^[a-zA-Z0-9_-]{1,50}$/)
        .optional(),
    })
    .strict()
    .parse(await body(request));
  requireWrite(
    await db()
      .prepare(
        `INSERT INTO waitlist (owner_id,email,price,referral,created_at) SELECT ?,?,?,?,? WHERE ${PROFILE_GENERATION_EXISTS} ON CONFLICT(owner_id) DO UPDATE SET email=excluded.email,price=excluded.price,referral=excluded.referral`,
      )
      .bind(
        current.id,
        data.email.toLowerCase(),
        data.price || null,
        data.ref || null,
        now(),
        ...generationArgs(current),
      )
      .run(),
  );
  await event(current, "waitlist_joined");
  return { ok: true };
}
const CLIENT_EVENTS = [
  "check_started",
  "quiz_done",
  "camera_denied",
  "capture_ok",
  "install_hint_seen",
  "label_shared",
] as const;
async function clientEvent(request: Request, current: Owner) {
  const data = z
    .object({ name: z.enum(CLIENT_EVENTS) })
    .strict()
    .parse(await body(request));
  await event(current, data.name);
  return { ok: true };
}

async function ensureInvite(current: Owner) {
  if (!current.generation) {
    const profile = await db()
      .prepare(
        "SELECT created_at FROM profiles WHERE owner_id = ? AND age_confirmed = 1",
      )
      .bind(current.id)
      .first<{ created_at: string }>();
    if (!profile)
      throw new HttpError(
        409,
        "Please refresh and confirm your age before using an invite.",
      );
    current.generation = profile.created_at;
  }
  const code = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  await db()
    .prepare(
      `INSERT OR IGNORE INTO invites (owner_id,code,referred_by,created_at) SELECT ?,?,NULL,? WHERE ${PROFILE_GENERATION_EXISTS}`,
    )
    .bind(current.id, code, now(), ...generationArgs(current))
    .run();
  const invite = await db()
    .prepare("SELECT code,referred_by FROM invites WHERE owner_id = ?")
    .bind(current.id)
    .first<{ code: string; referred_by: string | null }>();
  if (!invite)
    throw new HttpError(503, "The invite link could not be created.");
  if (
    !current.isGuest &&
    invite.referred_by &&
    invite.referred_by !== invite.code
  ) {
    await db()
      .prepare(
        `INSERT OR IGNORE INTO referral_signups (owner_id,code,created_at) SELECT ?,?,? WHERE ${PROFILE_GENERATION_EXISTS}`,
      )
      .bind(current.id, invite.referred_by, now(), ...generationArgs(current))
      .run();
  }
  return invite;
}
async function invite(request: Request, current: Owner) {
  const profile = await db()
    .prepare("SELECT age_confirmed,created_at FROM profiles WHERE owner_id = ?")
    .bind(current.id)
    .first<{ age_confirmed: number; created_at: string }>();
  if (profile?.age_confirmed !== 1)
    throw new HttpError(
      403,
      "Confirm you are 18 or older before using an invite.",
    );
  current.generation = profile.created_at;
  const own = await ensureInvite(current);
  if (request.method === "POST") {
    const data = z
      .object({ ref: z.string().regex(/^[a-f0-9]{16}$/) })
      .strict()
      .parse(await body(request));
    const source = await db()
      .prepare("SELECT code FROM invites WHERE code = ? AND owner_id != ?")
      .bind(data.ref, current.id)
      .first();
    if (source) {
      await db()
        .prepare(
          `UPDATE invites SET referred_by = COALESCE(referred_by,?) WHERE owner_id = ? AND ${PROFILE_GENERATION_EXISTS}`,
        )
        .bind(data.ref, current.id, ...generationArgs(current))
        .run();
      await ensureInvite(current);
    }
  }
  const count = await db()
    .prepare(
      "SELECT COUNT(*) AS count FROM referral_signups WHERE code = ? AND owner_id != ?",
    )
    .bind(own.code, current.id)
    .first<{ count: number }>();
  return { code: own.code, signups: count?.count ?? 0 };
}

async function admin(request: Request, current: Owner) {
  await requireAdmin(current);
  if (request.method === "PATCH") {
    const data = z
      .object({ dailyScanCap: z.number().int().min(0).max(10000) })
      .strict()
      .parse(await body(request));
    await db()
      .prepare(
        "INSERT INTO settings (key,value) VALUES ('daily_scan_cap',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .bind(String(data.dailyScanCap))
      .run();
    return { ok: true };
  }
  const [funnel, daily, totals, clicks, settings, waiting, returns, referrals] =
    await Promise.all([
      db()
        .prepare(
          "SELECT name,COUNT(*) AS count,COUNT(DISTINCT owner_id) AS users FROM events GROUP BY name",
        )
        .all<Row>(),
      db()
        .prepare(
          "SELECT SUBSTR(created_at,1,10) AS date,COUNT(*) AS count FROM scans GROUP BY date ORDER BY date DESC LIMIT 30",
        )
        .all<Row>(),
      db()
        .prepare(
          "SELECT COUNT(*) AS scans,SUM(CASE WHEN source = 'photo' THEN 1 ELSE 0 END) AS photoScans,COUNT(DISTINCT owner_id) AS users FROM scans",
        )
        .first<Row>(),
      db()
        .prepare(
          "SELECT json_extract(properties,'$.productId') AS productId,COUNT(*) AS count FROM events WHERE name = 'product_click' GROUP BY productId ORDER BY count DESC",
        )
        .all<Row>(),
      db()
        .prepare("SELECT value FROM settings WHERE key = 'daily_scan_cap'")
        .first<{ value: string }>(),
      db()
        .prepare("SELECT price,COUNT(*) AS count FROM waitlist GROUP BY price")
        .all<Row>(),
      db()
        .prepare(
          "SELECT COUNT(*) AS eligible, SUM(CASE WHEN EXISTS(SELECT 1 FROM events e WHERE e.owner_id = p.owner_id AND SUBSTR(e.created_at,1,10) = DATE(p.created_at,'+1 day')) THEN 1 ELSE 0 END) AS day1, SUM(CASE WHEN EXISTS(SELECT 1 FROM events e WHERE e.owner_id = p.owner_id AND SUBSTR(e.created_at,1,10) = DATE(p.created_at,'+7 day')) THEN 1 ELSE 0 END) AS day7 FROM profiles p WHERE p.created_at <= DATETIME('now','-7 days')",
        )
        .first<Row>(),
      db()
        .prepare(
          "SELECT code,COUNT(*) AS signups FROM referral_signups GROUP BY code ORDER BY signups DESC",
        )
        .all<Row>(),
    ]);
  return {
    funnel: funnel.results,
    daily: daily.results,
    totals,
    productClicks: clicks.results,
    dailyScanCap: Number(settings?.value ?? 20),
    waitlist: waiting.results,
    retention: returns,
    referrals: referrals.results,
    products: await catalog(true),
    security: {
      mechanism:
        "Every owned query is scoped by server identity; D1 is not a client database and does not implement PostgreSQL RLS.",
      tables: [
        "profiles",
        "consents",
        "scans",
        "routine_ticks",
        "shelf_items",
        "progress_photos",
        "waitlist",
        "events",
        "scan_reservations",
        "user_roles",
        "invites",
        "referral_signups",
      ],
      adminOnly: ["settings", "user_roles", "scan_daily_usage"],
      publicReadAdminWrite: ["products", "rules"],
    },
  };
}
async function adminProduct(request: Request, current: Owner) {
  await requireAdmin(current);
  const data = productSchema.parse(await body(request));
  if (!validateProduct(data))
    throw new HttpError(
      400,
      "This product does not meet the cosmetic catalogue safety rules.",
    );
  await db()
    .prepare(
      "INSERT INTO products (id,data_json,active,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,active=excluded.active,updated_at=excluded.updated_at",
    )
    .bind(data.id, JSON.stringify(data), data.active ? 1 : 0, now())
    .run();
  return { ok: true, product: data };
}
async function go(request: Request, current: Owner, path: string) {
  const productId = path.slice(3);
  const product = (await catalog()).find((p) => p.id === productId);
  if (!product) throw new HttpError(404, "Product no longer available.");
  const destination = safeProductUrl(product.affiliateUrl || product.url);
  if (!destination)
    throw new HttpError(400, "This product link is not available.");
  await event(current, "product_click", { productId: product.id });
  return new Response(null, {
    status: 302,
    headers: {
      location: destination,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}

export async function handle(request: Request): Promise<Response> {
  let current: Owner | undefined;
  try {
    const path = new URL(request.url).pathname
      .replace(/^\/api\//, "")
      .replace(/\/$/, "");
    current = await owner(request);
    const method = request.method;
    let result: unknown;
    if (
      method === "POST" &&
      ["consents", "routine", "shelf", "photos", "waitlist", "invite"].includes(
        path,
      )
    ) {
      const adult = await db()
        .prepare(
          "SELECT age_confirmed,created_at FROM profiles WHERE owner_id = ?",
        )
        .bind(current.id)
        .first<{ age_confirmed: number; created_at: string }>();
      if (adult?.age_confirmed !== 1)
        throw new HttpError(
          403,
          "Please confirm you are 18 or older before saving information.",
        );
      current.generation = adult.created_at;
    }
    if (path === "state" && method === "GET") result = await state(current);
    else if (path === "profile" && method === "POST")
      result = await saveProfile(request, current);
    else if (path === "consents" && method === "POST")
      result = await saveConsents(request, current);
    else if (path === "analyse" && method === "POST")
      result = await analyse(request, current);
    else if (path === "routine" && method === "POST")
      result = await saveTick(request, current);
    else if (path === "shelf" && ["POST", "DELETE"].includes(method))
      result = await modifyShelf(request, current);
    else if (path === "scans" && method === "GET") {
      const selected = new URL(request.url).searchParams.get("id");
      if (selected) {
        const scanId = z.string().uuid().parse(selected);
        const row = await db()
          .prepare("SELECT * FROM scans WHERE owner_id = ? AND id = ?")
          .bind(current.id, scanId)
          .first<Row>();
        if (!row)
          throw new HttpError(404, "This label was not found in your account.");
        result = { scans: [scan(row)] };
      } else
        result = {
          scans: (
            await db()
              .prepare(
                "SELECT * FROM scans WHERE owner_id = ? ORDER BY created_at DESC, id DESC LIMIT 200",
              )
              .bind(current.id)
              .all<Row>()
          ).results.map(scan),
        };
    } else if (path === "photos" && ["GET", "POST", "DELETE"].includes(method))
      result = await photos(request, current);
    else if (path === "export" && method === "GET")
      result = await exportData(current);
    else if (path === "account" && method === "DELETE") {
      const data = z
        .object({ confirm: z.literal("DELETE") })
        .strict()
        .parse(await body(request));
      void data;
      await deleteAccount(current.id);
      current.cookie =
        "tvacha_guest=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
      result = { ok: true };
    } else if (path === "waitlist" && method === "POST")
      result = await joinWaitlist(request, current);
    else if (path === "events" && method === "POST")
      result = await clientEvent(request, current);
    else if (path === "invite" && ["GET", "POST"].includes(method))
      result = await invite(request, current);
    else if (path === "admin" && ["GET", "PATCH"].includes(method))
      result = await admin(request, current);
    else if (path === "admin/products" && ["POST", "PATCH"].includes(method))
      result = await adminProduct(request, current);
    else if (path.startsWith("go/") && method === "GET")
      result = await go(request, current, path);
    else throw new HttpError(404, "This endpoint was not found.");
    return result instanceof Response ? result : json(result, current);
  } catch (error) {
    if (error instanceof ZodError)
      return json(
        {
          error:
            error.issues[0]?.message ||
            "Please check the information and try again.",
        },
        current,
        400,
      );
    if (error instanceof HttpError)
      return json({ error: error.message }, current, error.status);
    // Details intentionally stay out of logs: requests may contain facial images.
    return json(
      { error: "We could not finish that request. Please try again shortly." },
      current,
      503,
    );
  }
}
