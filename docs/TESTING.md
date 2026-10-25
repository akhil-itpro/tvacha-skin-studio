# Testing and verification evidence

[Back to README](../README.md)

## Quick checks

```sh
npm run docs:check
npm run typecheck
npm test
npm run build
```

The current unit/regression suite contains **69 tests**. The separate HTTP suite contains **7 tests**. Counts are a snapshot of this release, not a guarantee that every defect has been found.

## What the suites cover

| Layer | Evidence | Important limit |
| --- | --- | --- |
| Domain | Six-concern contracts, forbidden output, uncertainty, symptom stops, catalogue integrity, budgets, sensitivities, shelf matching and deterministic routines | Tests do not establish clinical/cosmetic accuracy |
| Photo preparation | Off-centre crops retain the subject; invalid/tiny detections preserve the original; pixel hints do not mutate pixels | Thresholds are suggestions, not calibrated quality guarantees |
| Browser request helper | Cancellation, timeouts, old AbortSignal compatibility, and fallback eligibility | Not a complete browser/device compatibility matrix |
| Provider adapter | Explicit configuration gates, bounded responses/retries, invalid output, rate limits, partial assessment and preservation of an initial valid result | Mocked responses establish control flow, not live provider availability |
| SQLite guards/quota | Atomic reservations, global cap, deletion resistance, stale profile/consent and cross-owner checks | Local SQL evidence is not a production security audit |
| History | 237 labels, tied timestamps, insertion during paging, metadata-only photos and malformed cursors | Not a load test of a large production database |
| HTTP | Two independent guest cookie jars, private photos, age/origin/role checks, export/deletion, consent independence, waitlist leave, platform mock sign-in and migration | Two guest identities and a local sign-in fixture are not two real production accounts |
| Browser QA | Upload/confirmation, quiz fallback, bookmark/history flow, download/share PNG and confidence display | Desktop testing and viewport checks do not replace Android/iPhone acceptance |

Tests live beside the modules in `src/domain`, `src/client` and `src/server`. HTTP tests use synthetic images and `example.test` addresses; they do not require a live AI key.

## HTTP integration locally

Initialize and migrate the local database first; see [setup](SETUP.md). Keep the dev server running in one terminal:

```sh
npm run dev
```

In another terminal on macOS/Linux:

```sh
TVACHA_TEST_URL=http://127.0.0.1:5173 TVACHA_ADMIN_TEST=1 npm run test:integration
```

In PowerShell:

```powershell
$env:TVACHA_TEST_URL='http://127.0.0.1:5173'
$env:TVACHA_ADMIN_TEST='1'
npm run test:integration
```

Use the exact server origin. `TVACHA_ADMIN_TEST=1` enables local-only sign-in/admin/referral fixtures. The suite temporarily grants and restores the local Seedy role. A migration test skips if that local account already holds data rather than deleting user work. For all seven checks without skips, use the fresh CI database. Do not point these lifecycle tests at a real-user production account.

## GitHub Actions

The [Verify workflow](../.github/workflows/verify.yml) uses Node 24, the lockfile installer, a documentation/repository check, TypeScript, unit tests, a production build, three fresh local migrations and the HTTP suite. It runs on pushes, pull requests and manual dispatch. It requires no provider key, deployment credential, real user data or production binding.

Actions are pinned by commit SHA and the job receives read-only repository permission. It does not automatically deploy the live Site. Workflow results should be read for the specific commit under review.

## Live provider probes

Provider checks are explicit opt-in operations and can consume the provider’s free allowance:

```sh
node scripts/prepare-quality-fixtures.mjs
node scripts/check-ai.mjs --quality-test
node scripts/check-ai.mjs --quality-test --clear-test
```

The checker accepts the key through hidden stdin. Do not put a key in a shell argument, file, issue or screenshot. The fixed fixture source is the [public MediaPipe portrait](https://storage.googleapis.com/mediapipe-assets/portrait.jpg). Generated files remain in ignored `outputs/photo-qa/`; no visitor image is used or deployed.

On 25 October 2026, real Groq requests accepted both a clear foreground-face fixture and a dim, blurred, heavily compressed 240-pixel-wide version. The degraded version returned six unreadable concerns; the clear version returned six assessable concerns. A prior blanket rejection and a retry-time rate limit exposed issues that were corrected. The model also made an incorrect subject-count interpretation during testing, reinforcing that correct JSON and model confidence are not accuracy evidence.

The optional `--vision-test` flag uses a faceless solid-color image to exercise rejection/fallback semantics. The script prints bounded status/timing/shape diagnostics and public-fixture tips, not credentials or image data.

## Manual acceptance before a public pilot

1. Test Android Chrome and iPhone Safari camera, upload, permission denial, orientation and repeated capture.
2. Try ordinary dim/compressed/soft-focus photos: suggestions must not block the flow; absent detail must not become a zero or invented finding.
3. Confirm a symptom stop shows no scan or products, and separate consent choices begin unticked.
4. Test guest-to-account migration and two independent real accounts on the actual hosted gateway.
5. Withdraw/re-grant consent or delete app data while analysis/upload is running; verify stale results do not reappear.
6. Verify export, individual photo deletion, saving withdrawal and complete app-data deletion on a controlled test account.
7. Check a share PNG for legible text, visible uncertainty and no face; test native share cancellation and download fallback.
8. Check installation and offline behavior; no private data should be available from a service-worker cache.
9. Review keyboard focus, reduced motion, 200% zoom and 390-pixel layout.
10. Evaluate errors across varied people, skin appearances, cameras and lighting under a consented protocol before making performance claims.

## Reproducing documentation checks

`npm run docs:check` validates local Markdown links, expected portfolio files, tracked-file exclusions and common credential patterns. It is a useful guardrail, not a comprehensive secret scanner or proof that external links, legal wording or business assumptions are correct.
