# Tvacha backend

Tvacha runs as a Vinext application on Cloudflare Workers. Sites provides deployment, D1 (`DB`), private R2 (`BUCKET`), and platform sign-in. D1 is accessed only from the server. It does not provide PostgreSQL row-level security: isolation is enforced by authenticated owner scoping on every private query. Do not describe it as RLS.

## Connected and unconnected services

- The quiz routine, catalogue, labels, saved history, ticks, shelf, consent ledger, export, deletion, waitlist, referrals, and founder APIs use the real database.
- The hosted app uses server-only `GROQ_API_KEY`, `PHOTO_AI_PROVIDER=groq`, `GROQ_MODEL=qwen/qwen3.8-27b` and `GROQ_ZDR_ENABLED=true`. Its account was verified on the Free plan and Inference APIs ZDR enabled on 25 October 2026. The actual model endpoint accepted the key and returned a valid retake response for a synthetic, faceless image. No payment method or upgrade was added.
- Groq's [vision documentation](https://console.groq.com/docs/vision), [free limits](https://console.groq.com/docs/rate-limits) and [data controls](https://console.groq.com/docs/your-data) were checked. Retention controls must remain enabled in the provider account; the environment flag records the operator's verified setup and cannot independently detect a later console change.
- Optional `GEMINI_MODEL` defaults to `gemini-3.8-flash`, but a configured key is insufficient: `GEMINI_DATA_POLICY=paid` is required. [Google's unpaid terms](https://ai.google.dev/gemini-api/terms) prohibit personal information, so its unpaid API is not used for selfies. No automatic provider failover occurs.
- Progress photos require both the separate opt-in and the R2 binding. Storage is private and every read/delete checks owner identity. An unavailable bucket never silently stores photos elsewhere.
- Sign-in is the hosting platform's **Sign in with ChatGPT**, not the prompt pack's email OTP. The documented Sites runtime owns its authentication routes; do not replace them with a mock OTP form.
- Payments are intentionally absent: the pack gates payments on business, KYC and legal requirements. The waitlist accepts no payment.

Provider-side data retention and the production legal notices must be reviewed for the selected provider account before public use. The application neither stores nor logs an analysis photo unless the user separately chooses progress-photo storage.

## Environment

Use `.dev.vars` locally and native Sites runtime secrets in production. Never place keys in the client or hosting manifest.

| Name | Meaning |
| --- | --- |
| `PHOTO_AI_PROVIDER` | `groq` (hosted free setup) or `gemini` (optional paid-data-policy setup). |
| `GROQ_API_KEY` | Server-only Groq API secret. |
| `GROQ_MODEL` | Defaults to `qwen/qwen3.8-27b`. |
| `GROQ_ZDR_ENABLED` | Set `true` only after enabling Inference APIs ZDR in Groq Data Controls. |
| `GEMINI_API_KEY` | Optional Google Gemini API secret. |
| `GEMINI_DATA_POLICY` | Must be `paid` to enable personal photo processing with Gemini. |
| `GEMINI_MODEL` | Optional model ID; default `gemini-3.8-flash`. |
| `ADMIN_USER_IDS` | Comma-separated site-scoped user IDs, with or without the `user:` prefix. |
| `ADMIN_EMAILS` | Exact email allowlist, checked only against trusted platform sign-in. The verified hosted owner is configured here. |

## Database migrations

The generated Drizzle SQL and metadata are tracked under `drizzle/`. Apply each unapplied file **once, in order**. Local and hosted databases are separate. Hosted Sites publication applies the tracked migrations.

1. `0000_next_stephen_strange.sql` creates the thirteen core tables.
2. `0001_spotty_marten_broadcloak.sql` adds anonymous global daily scan usage.
3. `0002_military_dazzler.sql` adds opaque invite codes and referral signups.

After building to generate `dist/server/wrangler.json`, run the starter's documented command separately for each unapplied migration:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_next_stephen_strange.sql
```

Use the corresponding second and third filenames for the later migrations. Do not replay an applied migration. The catalogue, ingredient-rule data and default daily cap are seeded with idempotent data inserts on the first catalogue request; request handlers never create or alter tables.

## Administrator setup

1. Sign in to Tvacha using its platform sign-in link.
2. Inspect your own `user.id` returned by `/api/state`; it looks like `user:<site-scoped-id>`.
3. Configure that exact value in the server's `ADMIN_USER_IDS` secret and redeploy. Restart local dev after changing `.dev.vars`.
4. Alternatively, using an authenticated database administration channel, insert that full `user:` value into `user_roles.owner_id` with role `admin`.
5. Visit `/admin`. Both its data and mutation APIs check the role on the server. No first visitor is automatically made an administrator.

The product editor accepts full `Product` JSON. It validates the price band, HTTPS destination store, minimum sunscreen SPF, cosmetic language and restricted ingredients. Deactivated products remain editable in admin and disappear from new recommendations. The public catalogue is read-only.

## API contracts

All JSON mutation requests require `Content-Type: application/json` and a same-origin browser `Origin`. Body size is bounded while streaming. Do not send a user ID: server identity determines ownership. Error responses have `{error: string}` and an appropriate HTTP status.

| Endpoint | Contract |
| --- | --- |
| `GET /api/state` | User, profile, current consent flags, scans, ticks, shelf, active products, photo metadata, waitlist status, admin flag, service availability, existing `inviteCode` or null. |
| `POST /api/profile` | `{ageConfirmed:true, quiz?}`. Under-18 confirmation cannot be accepted. |
| `POST /api/consents` | `{analysis?:boolean, progressPhotos?:boolean}`. At least one explicit purpose is required; omitted purposes preserve the current server choice. Explicit false withdraws and deletes saved photos. Analysis consent is stamped with its named provider; a provider change requires new consent. |
| `POST /api/analyse` | `{quiz, mode:'quiz'|'photo', image?:JPEGDataURL}`; returns `{scan,routine,message}`. Unusable photos complete as a labelled quiz routine; no mandatory retake response. |
| `POST /api/routine` | `{date:'YYYY-MM-DD',slot:'AM'|'PM',step,done:boolean}`. |
| `POST /api/shelf` | `{name,step,productId?,hasActive?}`; returns `{item}`. |
| `DELETE /api/shelf` | `{id}`. |
| `GET /api/scans` | Owner-only cursor pages with `scans`, `nextCursor`, `totalCount`; `?id=` reads an owned label. |
| `GET /api/photos` | Owner-only cursor pages with photo metadata, `nextCursor`, `totalCount`. |
| `GET /api/photos?id=<uuid>` | Private JPEG with no-store headers. |
| `POST /api/photos` | `{scanId,image:JPEGDataURL}`. Existing owned scan and current opt-in required. |
| `DELETE /api/photos` | `{id}`. |
| `GET /api/export` | Owned records, own app events, and photo metadata as JSON. Individual JPEGs use `/api/photos`. |
| `DELETE /api/account` | `{confirm:'DELETE'}`. Deletes this app's data and photos immediately; does not delete the user's ChatGPT account. |
| `POST /api/waitlist` | `{email,price?:'49'|'99'|'199'|'wouldnt_pay',ref?}`. |
| `DELETE /api/waitlist` | `{}` removes only the current owner’s membership. |
| `GET /api/invite` | After 18+ confirmation, returns opaque `{code,signups}`. |
| `POST /api/invite` | After 18+ confirmation, `{ref:'16-hex-code'}`. Retain a landing referral in session memory until age confirmation. First valid referral wins; account sign-in records a signup. |
| `POST /api/events` | `{name}` from the client-event allowlist only; arbitrary properties and photo data are rejected. |
| `GET /api/go/<product-id>` | Validates an approved HTTPS store URL, logs the product click server-side, redirects. |
| `GET /api/admin` | Founder funnel, daily scans, click counts, retention, waitlist counts, referral signups, catalogue and security mechanism. |
| `PATCH /api/admin` | `{dailyScanCap:0..10000}`. |
| `POST/PATCH /api/admin/products` | A complete validated `Product` object. |
| `PATCH /api/admin/site` | `{operatorName,supportEmail}`; validated contact fields only. |

## Isolation and deletion

The signed-in owner ID comes from the platform helper. Guests receive a random HttpOnly, SameSite=Lax cookie, Secure over HTTPS; a client-supplied JSON owner ID has no authority. Signing in migrates the current guest's private rows into that account. Browser guest identities are session identifiers, so clearing the cookie starts a new guest identity.

Every private table is queried with the server's owner ID: profiles, consents, scans, ticks, shelf, events, progress-photo metadata, waitlist, personal scan reservations, invites and referral signups. Shared product/rule writes and settings/role reads require admin access. D1 and R2 bindings are never exposed to browsers.

Photo quotas are reserved in a D1 transaction: one scan per guest identity/day, three per account/day, plus the server-controlled global cap (default 20). Anonymous global usage survives account deletion, so deletion cannot reset the application's cost cap. No owner identifier is retained in that aggregate. Failed provider attempts count toward the cap.

After a model call, scan storage and analytics are one guarded transaction. The original 18+ profile and the exact original, still-granted analysis consent must still exist. Deletion or consent changes while analysis is running discard the result. Progress-photo insertion similarly checks current opt-in after uploading and removes the object if permission changed.

Other owned inserts (shelf, routine ticks, consent records, waitlist, invites, referral signups and related analytics) also check the original profile creation generation in the write statement. A stale request cannot recreate those rows after deletion or write into a freshly recreated profile. Progress photos require the exact original progress-consent record as well as the original profile generation and an existing owned scan.

Deletion removes owned rows, roles, invite records and R2 objects. If R2 is temporarily unavailable while stored photos exist, deletion returns an error for retry rather than claiming the photos were deleted. Export contains the owner's records and photo metadata only, never another user, secrets, other users’ analytics or the internal R2 keys. The user’s own event records are included.

## Verification

```powershell
node --experimental-strip-types --test src/server/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

The backend unit tests exercise real quota and privacy-guard SQL with SQLite, zero/personal/global caps, deletion-resistant anonymous usage, in-flight consent withdrawal/account deletion, stale mutation rejection after profile recreation, cross-owner consent rejection, same-origin enforcement, safe redirect destinations, quiz validation, upload bounds and catalogue validation. Separate HTTP integration checks should exercise two independent cookie jars against the running local application; unit results alone do not prove deployed cross-account isolation or real-device camera behavior.

Run the optional HTTP integration suite against an already running, migrated local server:

```powershell
$env:TVACHA_TEST_URL='http://127.0.0.1:5173'
$env:TVACHA_ADMIN_TEST='1'
node --experimental-strip-types --test src/server/integration.test.mjs
```

`TVACHA_ADMIN_TEST=1` enables local-only platform sign-in/admin/referral fixtures. It temporarily grants and restores the local Seedy role; a migration fixture runs only when that local account has no existing app data, to preserve user work. The seven HTTP tests passed against local D1 and R2 on 25 October 2026. They use synthetic JPEGs and fixture-only addresses, with no real face photos or provider charges.

| Table | Boundary and verification |
| --- | --- |
| `profiles` | Server owner key; guest isolation, age rejection, spoofed-owner rejection and account deletion exercised over HTTP. |
| `consents` | Owner-filtered current flags; different guests see different flags; guest-to-account migration and withdrawal exercised. |
| `scans` | Owner-filtered reads/export; separate-cookie visibility and migration exercised; deletion/withdrawal race guarded SQL tested. |
| `routine_ticks` | Owner-filtered reads and composite owner/date/slot/step writes; separate-cookie visibility and deletion exercised. |
| `shelf_items` | Owner-filtered reads/deletes; second guest cannot remove first guest's item; migration exercised. |
| `progress_photos` | Owner-filtered metadata and R2 key resolution; second guest read/upload/delete denied; opt-in, JPEG retrieval and withdrawal deletion exercised. |
| `waitlist` | Owner-filtered membership/export; age guard and distinct guest membership exercised. |
| `events` | Server-owned event insertion; public mutation is an allowlisted event name only; export includes only the owner’s own events; admin exposes aggregates. |
| `products` | Shared read, admin-only validated writes; guest writes denied; invalid admin product/SPF rejected. |
| `rules` | Shared validated rule data, seeded server-side; no public mutation route. |
| `settings` | Server/admin writes only; cap and contact edits require admin. Only the validated operator/support fields are exposed for legal pages. Guest writes denied; admin save/restore exercised. |
| `user_roles` | Server only; normal signed-in account denied admin; explicit role grants access and fixture restores it. |
| `scan_reservations` | Server only, owner/day filter; guest/account limits and transaction SQL tested. |
| `scan_daily_usage` | Anonymous server-only aggregate; SQL tests confirm personal deletion cannot reset the global cap. |
| `invites` | Owner-filtered opaque code; HTTP verifies no owner ID in link and migration. |
| `referral_signups` | Server sign-in attribution and owner deletion; HTTP verifies signup count after guest migration. |

This is tested server authorization, not database RLS certification. Production authentication and real Groq requests were checked separately. Real Android/iPhone camera behavior still requires device acceptance.

## History and contact configuration

Photo results allow `level: null` only with low confidence and no inferred zones. Clear zeroes remain distinct from missing detail. Photo checks always finish with a saved result when the request and consent remain valid: partial observations when a primary face can be assessed, or a labelled quiz routine when it cannot. The optional client detector supplies framing only and cannot authorize results or bypass server validation.

For repeatable provider QA, run `node scripts/prepare-quality-fixtures.mjs`, then `node scripts/check-ai.mjs --quality-test` or append `--clear-test`. The checker accepts the key through hidden stdin only; it sends the fixed public test portrait, not a visitor photo. Provider diagnostics are limited to statuses, timing, validation and test-fixture photo tips. Generated fixtures stay in ignored `outputs/photo-qa/`; no fixture is deployed. Free provider rate limits still apply. A quality review that encounters a limit retains the initial valid assessment.

`GET /api/scans` and `GET /api/photos` return owner-only pages with `nextCursor` and `totalCount`. Pages default to 30 records, with a maximum of 50. The cursor combines creation timestamp and ID; every query still filters the server identity. `?id=` retrieves an individually owned label/photo. Photo lists expose metadata only.

Consent writes may specify `analysis`, `progressPhotos`, or both; at least one explicit choice is required. Omitted purposes remain untouched. `DELETE /api/waitlist` with `{}` removes only the current owner’s membership. `PATCH /api/admin/site` takes `{operatorName,supportEmail}`; both may be cleared. Only these validated contact fields are shared in `/api/state`, never arbitrary settings.
