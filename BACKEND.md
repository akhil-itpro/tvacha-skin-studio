# Tvacha backend

Tvacha runs as a Vinext application on Cloudflare Workers. Sites provides deployment, D1 (`DB`), private R2 (`BUCKET`), and platform sign-in. D1 is accessed only from the server. It does not provide PostgreSQL row-level security: isolation is enforced by authenticated owner scoping on every private query. Do not describe it as RLS.

## Connected and unconnected services

- The quiz routine, catalogue, labels, saved history, ticks, shelf, consent ledger, export, deletion, waitlist, referrals, and founder APIs use the real database.
- Photo estimates need a server-only `GEMINI_API_KEY`. Without it, `/api/analyse` saves an explicitly labelled quiz routine with `analysis: null`. It never returns invented concern scores. `GET /api/state` exposes only the boolean service availability.
- `GEMINI_MODEL` defaults to `gemini-3.8-flash`. The server calls Google's HTTPS API directly; Lovable's connector and credits are not involved. Current official [image documentation](https://ai.google.dev/gemini-api/docs/image-understanding) and [structured-output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) were checked on 24 October 2026.
- Progress photos require both the separate opt-in and the R2 binding. Storage is private and every read/delete checks owner identity. An unavailable bucket never silently stores photos elsewhere.
- Sign-in is the hosting platform's **Sign in with ChatGPT**, not the prompt pack's email OTP. The documented Sites runtime owns its authentication routes; do not replace them with a mock OTP form.
- Payments are intentionally absent: the pack gates payments on business, KYC and legal requirements. The waitlist accepts no payment.

Provider-side data retention and the production legal notices must be reviewed for the selected Gemini account before public use. The application neither stores nor logs an analysis photo unless the user separately chooses progress-photo storage.

## Environment

Use `.dev.vars` locally and native Sites runtime secrets in production. Never place keys in the client or hosting manifest.

| Name | Meaning |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini API secret. Optional; enables photo analysis when configured. |
| `GEMINI_MODEL` | Optional model ID; default `gemini-3.8-flash`. |
| `ADMIN_USER_IDS` | Comma-separated site-scoped user IDs, with or without the `user:` prefix. |

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
| `POST /api/consents` | `{analysis:boolean, progressPhotos:boolean}`. Separate versioned records; withdrawing photo consent removes stored photos. |
| `POST /api/analyse` | `{quiz, mode:'quiz'|'photo', image?:JPEGDataURL}`; returns `{scan,routine,message}` or `{retake:true,retakeReasons,routine,message}`. |
| `POST /api/routine` | `{date:'YYYY-MM-DD',slot:'AM'|'PM',step,done:boolean}`. |
| `POST /api/shelf` | `{name,step,productId?,hasActive?}`; returns `{item}`. |
| `DELETE /api/shelf` | `{id}`. |
| `GET /api/scans` | Owner's scans, newest first. |
| `GET /api/photos?id=<uuid>` | Private JPEG with no-store headers. |
| `POST /api/photos` | `{scanId,image:JPEGDataURL}`. Existing owned scan and current opt-in required. |
| `DELETE /api/photos` | `{id}`. |
| `GET /api/export` | Owned records and photo metadata as JSON. Individual JPEGs use `/api/photos`. |
| `DELETE /api/account` | `{confirm:'DELETE'}`. Deletes this app's data and photos immediately; does not delete the user's ChatGPT account. |
| `POST /api/waitlist` | `{email,price?:'49'|'99'|'199'|'wouldnt_pay',ref?}`. |
| `GET /api/invite` | After 18+ confirmation, returns opaque `{code,signups}`. |
| `POST /api/invite` | After 18+ confirmation, `{ref:'16-hex-code'}`. Retain a landing referral in session memory until age confirmation. First valid referral wins; account sign-in records a signup. |
| `POST /api/events` | `{name}` from the client-event allowlist only; arbitrary properties and photo data are rejected. |
| `GET /api/go/<product-id>` | Validates an approved HTTPS store URL, logs the product click server-side, redirects. |
| `GET /api/admin` | Founder funnel, daily scans, click counts, retention, waitlist counts, referral signups, catalogue and security mechanism. |
| `PATCH /api/admin` | `{dailyScanCap:0..10000}`. |
| `POST/PATCH /api/admin/products` | A complete validated `Product` object. |

## Isolation and deletion

The signed-in owner ID comes from the platform helper. Guests receive a random HttpOnly, SameSite=Lax cookie, Secure over HTTPS; a client-supplied JSON owner ID has no authority. Signing in migrates the current guest's private rows into that account. Browser guest identities are session identifiers, so clearing the cookie starts a new guest identity.

Every private table is queried with the server's owner ID: profiles, consents, scans, ticks, shelf, events, progress-photo metadata, waitlist, personal scan reservations, invites and referral signups. Shared product/rule writes and settings/role reads require admin access. D1 and R2 bindings are never exposed to browsers.

Photo quotas are reserved in a D1 transaction: one scan per guest identity/day, three per account/day, plus the server-controlled global cap (default 20). Anonymous global usage survives account deletion, so deletion cannot reset the application's cost cap. No owner identifier is retained in that aggregate. Failed provider attempts count toward the cap.

After a model call, scan storage and analytics are one guarded transaction. The original 18+ profile and the exact original, still-granted analysis consent must still exist. Deletion or consent changes while analysis is running discard the result. Progress-photo insertion similarly checks current opt-in after uploading and removes the object if permission changed.

Other owned inserts (shelf, routine ticks, consent records, waitlist, invites, referral signups and related analytics) also check the original profile creation generation in the write statement. A stale request cannot recreate those rows after deletion or write into a freshly recreated profile. Progress photos require the exact original progress-consent record as well as the original profile generation and an existing owned scan.

Deletion removes owned rows, roles, invite records and R2 objects. If R2 is temporarily unavailable while stored photos exist, deletion returns an error for retry rather than claiming the photos were deleted. Export contains the owner's records and photo metadata only, never another user, secrets, internal analytics or the internal R2 keys.

## Verification

```powershell
node --experimental-strip-types --test src/server/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

The thirteen backend unit tests exercise real quota and privacy-guard SQL with SQLite, zero/personal/global caps, deletion-resistant anonymous usage, in-flight consent withdrawal/account deletion, stale mutation rejection after profile recreation, cross-owner consent rejection, same-origin enforcement, safe redirect destinations, quiz validation, upload bounds and catalogue validation. Separate HTTP integration checks should exercise two independent cookie jars against the running local application; unit results alone do not prove deployed cross-account isolation or real-device camera behavior.

Run the optional HTTP integration suite against an already running, migrated local server:

```powershell
$env:TVACHA_TEST_URL='http://127.0.0.1:5173'
$env:TVACHA_ADMIN_TEST='1'
node --experimental-strip-types --test src/server/integration.test.mjs
```

`TVACHA_ADMIN_TEST=1` enables local-only platform sign-in/admin/referral fixtures. It temporarily grants and restores the local Seedy role; a migration fixture runs only when that local account has no existing app data, to preserve user work. The six HTTP tests passed against local D1 and R2 on 24 October 2026. They use synthetic JPEGs and fixture-only addresses, with no real face photos or provider charges.

| Table | Boundary and verification |
| --- | --- |
| `profiles` | Server owner key; guest isolation, age rejection, spoofed-owner rejection and account deletion exercised over HTTP. |
| `consents` | Owner-filtered current flags; different guests see different flags; guest-to-account migration and withdrawal exercised. |
| `scans` | Owner-filtered reads/export; separate-cookie visibility and migration exercised; deletion/withdrawal race guarded SQL tested. |
| `routine_ticks` | Owner-filtered reads and composite owner/date/slot/step writes; separate-cookie visibility and deletion exercised. |
| `shelf_items` | Owner-filtered reads/deletes; second guest cannot remove first guest's item; migration exercised. |
| `progress_photos` | Owner-filtered metadata and R2 key resolution; second guest read/upload/delete denied; opt-in, JPEG retrieval and withdrawal deletion exercised. |
| `waitlist` | Owner-filtered membership/export; age guard and distinct guest membership exercised. |
| `events` | Server-owned event insertion; public mutation is an allowlisted event name only; export omits analytics and admin exposes aggregates. |
| `products` | Shared read, admin-only validated writes; guest writes denied; invalid admin product/SPF rejected. |
| `rules` | Shared validated rule data, seeded server-side; no public mutation route. |
| `settings` | Server/admin only; guest write denied and authorized cap save exercised. |
| `user_roles` | Server only; normal signed-in account denied admin; explicit role grants access and fixture restores it. |
| `scan_reservations` | Server only, owner/day filter; guest/account limits and transaction SQL tested. |
| `scan_daily_usage` | Anonymous server-only aggregate; SQL tests confirm personal deletion cannot reset the global cap. |
| `invites` | Owner-filtered opaque code; HTTP verifies no owner ID in link and migration. |
| `referral_signups` | Server sign-in attribution and owner deletion; HTTP verifies signup count after guest migration. |

This is tested server authorization, not database RLS certification. Production authentication, real Gemini calls and real Android/iPhone camera behavior still require deployment/device checks.
