# Tvacha

A working, phone-first cosmetic skincare app for adults 18+ in India. Built from the supplied Tvacha prompt pack, with a real server, durable database, private photo storage, and deterministic product recommendations. It runs on React, TypeScript and Vinext on Cloudflare Workers through Sites.

Tvacha gives cosmetic guidance, not a diagnosis. The UI calls out uncertainty and never invents a photo result when the provider is unavailable.

## What is implemented

- Responsive overview and Check, Routine, Shelf, Progress and account screens, with an accessible mobile navigation and a complete `/styleguide`.
- Age gate, two separate unticked consent choices, four-question quiz, and a symptom check that stops the scan and product flow when any red flag is selected.
- Front-camera capture, mirrored preview, on-device single-face/position/light/sharpness checks, JPEG resize, photo confirmation and upload fallback. The original photo stays in memory unless the user separately chooses to save it.
- Server-only Groq image analysis with explicit zero-data-retention configuration, bounded requests, strict JSON validation, one retry and prohibited-language checks. Optional Gemini integration requires paid-service data protections. Provider failure or missing configuration gives a clearly labelled quiz routine with no photo scores.
- A printed Skin Label for valid photo results, confidence per concern, up to three focus areas, AM/PM routines and ingredient guidance.
- 24 real products from three official brand catalogues. Prices are dated reference list prices, not a live price feed. Product selection is code, never AI or commission-based ranking. Budget, fragrance, pregnancy cautions, shelf coverage, sunscreen and one-new-active limits are enforced. Lower-cost eligible alternatives appear beside product picks.
- Complete paginated label/photo history, daily routine ticks, gentle weekly progress, shelf search/free-text entry, comparisons and weekly rescan reminders.
- Platform sign-in, guest-to-account migration, private opt-in progress photos, individual deletion, JSON export and deletion of all Tvacha account data.
- Server-authorized founder analytics, scan caps, product editing/deactivation, editable operator/support details, an opaque invite link with referral signup counts, and a Pro waitlist with join/leave controls and an optional price question. No payments.
- Face-free PNG label sharing/download, installable web app metadata and icons, install guidance, and a generic offline page. Personal data and face photos are excluded from the service-worker cache.
- Self-hosted Archivo, Atkinson Hyperlegible Next and IBM Plex Mono fonts. Source URLs, checksums and font licenses are in `public/fonts`.

Read [BACKEND.md](./BACKEND.md) for exact API contracts, ownership rules, quota behavior and deletion safeguards.

## Important differences from the Lovable pack

This app uses **Sites + Cloudflare**, rather than Lovable Cloud. Hosting owns **Sign in with ChatGPT**; there is no pretend email-OTP form. D1 is server-only SQLite: private data access is enforced through the server's authenticated owner ID, not PostgreSQL row-level-security policies. Do not claim PostgreSQL RLS is enabled.

The hosted app now uses the Groq Free plan with `qwen/qwen3.8-27b`. Its inference zero-data-retention control was enabled and the key/model connection and a synthetic-image retake request were verified on 25 October 2026. No paid plan was enabled. Lovable credits do not apply. Photo AI has no fabricated demo response. Rate limits still apply, and real-person photo quality is not established by a synthetic-image test.

The supplied pack deliberately gates payments on business, KYC and legal prerequisites. This build keeps Pro as a waitlist and does not charge visitors.

## Local startup on Windows

Requirements: Node.js 24 LTS is recommended (the app requires at least 22.13; the quota tests use Node's SQLite module), plus npm for a clean dependency installation. Dependencies are already installed in this checkout.

```powershell
Set-Location D:\SkinApp\tvacha
node scripts/run-framework.mjs build
```

On a fresh checkout, run `npm run install:ci` first. If PowerShell blocks npm's script shim, use `npm.cmd run install:ci`. Do not run concurrent dependency installers.

The first build emits `dist/server/wrangler.json`. Apply each **unapplied** migration once, in order:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_next_stephen_strange.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_spotty_marten_broadcloak.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_military_dazzler.sql
```

Local database state lives in ignored `.wrangler/state`. These commands do not modify production. Migrations are generated from `db/schema.ts`; request handlers seed product/rule/default-cap records idempotently but never create database tables.

Start development:

```powershell
node scripts/run-framework.mjs dev
```

Open the loopback URL printed by the server, normally `http://localhost:5173`. Keep local previews on loopback. Camera access on a phone needs the hosted HTTPS URL.

For the production-build preview:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --inspector-port 0
```

The local development sign-in route `/signin-with-chatgpt?return_to=/me` uses the starter's loopback-only development identity. Production does not include this mock. The built Worker preview does not simulate sign-in.

## Connect live photo analysis

Create an ignored `.dev.vars` file for local secrets:

```dotenv
PHOTO_AI_PROVIDER=groq
GROQ_API_KEY=your_server_only_groq_key
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_ZDR_ENABLED=true
ADMIN_USER_IDS=user:your_site_scoped_user_id
```

Use the native Sites runtime environment/secrets controls for production. Never commit keys or add them to `public/`, browser code, `.openai/hosting.json`, screenshots or logs. Restart local development after changing `.dev.vars`; redeploy after changing production runtime settings.

Keep the account on its Free plan. First enable **Inference APIs ZDR** at the [Groq Data Controls page](https://console.groq.com/settings/data-controls); set `GROQ_ZDR_ENABLED=true` only after verifying that control. The hosted secret is already configured; real keys are never committed or copied into local source. If you change Groq's retention setting later, disable photo analysis until it is restored.

Google's [unpaid Gemini terms](https://ai.google.dev/gemini-api/terms) prohibit personal or sensitive information. For a Gemini alternative, use a project with paid-service data protections and set `GEMINI_DATA_POLICY=paid`; the unpaid Gemini API is not enabled for selfies. The Free-plan Groq connection avoids this requirement.

Without a ready provider the quiz-to-routine experience works, and the UI states that photo analysis is not connected. `GET /api/state` exposes provider availability/model information, never the secret. A model error, invalid result or exhausted quota gives the quiz fallback. Session, consent, and validation rejections are shown as errors instead of bypassed through an offline routine.

Bindings in `.openai/hosting.json` are D1 `DB` and private R2 `BUCKET`. Hosted Sites provisions these bindings and applies tracked migrations on publication. Production and local data are independent.

Photo scanning reserves one attempt per guest identity/day or three per signed-in account/day, subject to the global daily cap, initially 20. Failed provider attempts count toward cost protection. Guests are identified by an HttpOnly cookie; clearing cookies creates a new guest identity, while the global cost cap still applies. The quota day uses UTC.

## Give your account founder access

The hosted owner's trusted sign-in email is now explicitly configured in the server-only `ADMIN_EMAILS` allowlist. Sign in using that account to access `/admin`. No visitor can claim the role through a client request.

1. Sign in to the hosted app and open `/api/state` while signed in.
2. Copy your own `user.id`, including its `user:` prefix.
3. Add it to the server-only `ADMIN_USER_IDS` setting and redeploy.
4. Visit `/admin`. The server checks permission for reads and writes.

Alternatively, a trusted database administrator can insert that exact owner ID into `user_roles` with `role = 'admin'`. No first visitor is automatically an administrator.

Product URLs initially go to official stores with no affiliate relationship configured. If an approved affiliate URL is added, the adjacent commission disclosure must remain visible. Catalogue editing rejects prescription/fairness products, inappropriate sunscreen SPF, inconsistent budget bands and disguised exfoliating-active flags. Replace prices only after checking the exact pack size and current label.

## Verify

```powershell
node --test src/domain/domain.test.mjs
node --experimental-strip-types --test src/server/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-framework.mjs build
```

Run `npm test` for all 61 unit/regression checks. The seven HTTP integration checks run against the local database/storage with `TVACHA_TEST_URL` and `TVACHA_ADMIN_TEST=1`, as documented in BACKEND.md. The suite checks catalogue integrity, strict six-concern JSON, restricted output, uncertainty, symptom stops, budget/sensitivity combinations, safe shelf matching, date validity, provider retries, bounded responses, data policy gates, deletion barriers, quotas, private photos and sign-in migration.

Unit tests do not establish clinical accuracy, real-provider latency, deployed account isolation or real-device camera quality. See the task's verification report for checks actually completed. Re-run relevant tests when changing safety rules, data ownership, consent or product selection.

## Phone acceptance checklist

Use the deployed HTTPS app on Android Chrome and iPhone Safari:

1. Start a check; verify under-18 ends politely and both consent choices begin unchecked. Complete the quiz, then select a red flag: no camera, scan or products should follow.
2. Start again without red flags. Deny camera access and confirm the upload option appears. Test no face, two faces, dark light and a blurry photo; capture should remain blocked. Use a clear front-facing photo and confirm/retake.
3. With AI configured, check all six concern rows and their confidence labels. With AI unavailable, confirm there are no invented levels and that the result clearly says quiz-based.
4. Change budgets and sensitivities. Confirm picks stay within budget, fragrance exclusions apply, pregnancy cautions are respected and sunscreen remains a step even when no catalogue product fits.
5. Tick routine steps, refresh and confirm they survive. Add an owned product and verify the same step is no longer sold again. Compare two valid labels; a low-confidence comparison must say “not sure”.
6. Save a guest label by signing in. Use a second account/browser profile to check that scans, ticks, shelf, consent and photos are isolated. A normal account must be denied founder APIs.
7. Opt into progress photos, save one and delete it individually. Withdraw photo consent and confirm every saved photo is removed. Export data, then delete the Tvacha account data and verify old records and photo links are gone.
8. Share/download the label and inspect the PNG: no face should appear. Install on the home screen; go offline and confirm the generic reconnect page appears without cached personal information.
9. Test at 390 px width, 200% text zoom, keyboard navigation and reduced motion. Run the photo checks across varied skin tones and lighting conditions before accepting the thresholds.

## Before a public launch

- Configure and verify the real AI account/model, provider retention settings, operating budget and scan cap. Check five live scans; do not infer photo accuracy from a working UI.
- Add the real operator/grievance contact and obtain the legal review requested in the pack for the DRAFT Privacy and Terms pages, cosmetic claims, consent and brand name. Current drafts are not a legal approval.
- Verify the catalogue pack sizes, ingredients, cautions, reference prices, store availability and any affiliate arrangement. Spending more is optional; do not fill a safety/budget gap with an unsuitable product.
- Complete the independent two-account and phone acceptance checks above against the production deployment. Keep the Site's current private audience until the intended launch audience is explicitly selected.
- Maintain an incident response and deletion-support process. The app deletes its own data; it does not delete a visitor's separate ChatGPT account or control a third-party provider's retention.

## Source map

| Path | Purpose |
| --- | --- |
| `app/components` | Main app screens, camera and design-system specimen |
| `app/fonts.css`, `public/fonts` | Locally served typography and licenses |
| `src/domain` | Shared types, product catalogue, validation, recommendation and comparison logic |
| `src/client` | Typed browser API helpers and UI data contracts |
| `src/server` | Owner-scoped endpoints, consent, quotas and photo-provider boundary |
| `db/schema.ts`, `drizzle` | Sixteen-table D1 schema and versioned SQL migrations |
| `public/manifest.webmanifest`, `public/sw.js` | Installation metadata and privacy-preserving offline fallback |
| `worker/index.ts`, `vite.config.ts` | Production Worker and preserved Sites build integration |
| `.openai/hosting.json` | Site identity and logical storage bindings, never secrets |
