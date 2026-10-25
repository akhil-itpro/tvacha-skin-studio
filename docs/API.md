# API reference

[Back to README](../README.md) · [Implementation: `src/server/api.ts`](../src/server/api.ts)

## Conventions and security

Base path: `/api`. Requests are same-origin. JSON mutations require `Content-Type: application/json` and a browser `Origin` matching the request origin. Body size is bounded while streaming. Cookies/platform identity determine the owner; passing `ownerId` does not authorize a different account.

Most collection writes require an existing 18+ profile. Read APIs and founder APIs enforce their own identity/role boundaries. Errors return `{ "error": "human-readable message" }` with an HTTP status. Private data and photo responses are not public cache assets.

| Status | Typical meaning |
| --- | --- |
| 400 | Invalid body, unsupported field, invalid date/cursor/image or product |
| 403 | Missing age confirmation/consent, same-origin rejection or forbidden admin operation |
| 404 | Missing or non-owned label/photo/product; unknown endpoint |
| 409 | Profile or consent changed while the request was running |
| 413 / 415 | Body too large / unsupported request content type |
| 422 | Declared symptom red flag prevents analysis and recommendations |
| 503 | Required service unavailable or request could not complete |

Provider rate limits and quota exhaustion normally complete as honest quiz guidance rather than exposing a provider response or inventing a photo score.

## Profile and consent

| Method and path | Body / response |
| --- | --- |
| `GET /state` | User, profile, current consents, first history pages/counts/cursors, ticks, shelf, active products/rules, photo metadata, waitlist/admin flags, invite code, selected operator/support fields and non-secret provider availability |
| `POST /profile` | `{ageConfirmed:true, quiz?}` → `{ok:true}` |
| `POST /consents` | `{analysis?:boolean, progressPhotos?:boolean}`; at least one explicit purpose → `{ok:true}` |

Omitted consent purposes stay untouched. Explicit `progressPhotos:false` withdraws photo-saving consent and deletes stored progress photos. Analysis consent records its named provider version; changing providers requires review before a new photo request.

Quiz contract:

```json
{
  "skinFeel": "combination",
  "mainConcern": "shine",
  "budget": "under400",
  "sensitivities": ["none"],
  "redFlags": []
}
```

`skinFeel`: `oily | combination | normal | dry`. Budgets: `under400 | 400to800 | 800plus`. Sensitivities: distinct values from `fragrance | pregnant | none`; `none` cannot combine with another value. Concern keys are the six keys below. Any selected symptom flag stops the check.

## Analysis

`POST /analyse`

```json
{
  "mode": "quiz",
  "quiz": {
    "skinFeel": "combination",
    "mainConcern": "shine",
    "budget": "400to800",
    "sensitivities": ["none"],
    "redFlags": []
  }
}
```

For photo mode use `mode:"photo"` and `image` containing the app-prepared JPEG data URL. Current bounds are 32–1600 pixels per side and approximately 1.65 MB decoded JPEG; the request is capped at 2.25 MB. These are technical transport bounds, not an accuracy claim. The client supports other decodable upload formats and prepares JPEG before sending.

Success returns `{scan,routine,message}`. `scan` has `id`, `createdAt`, `quiz`, `analysis`, `source`, `model` and `message`. `source` is `photo` only for an accepted photo assessment; quiz-only/fallback results use `quiz` and `analysis:null`. A photo with no usable subject still completes with a quiz routine. The active server no longer requires a retake loop.

`analysis` has exactly `image_ok`, `retake_reasons` and `concerns`. Six unique concern keys are required:

```text
shine · breakouts · dark_spots · redness · dryness · under_eye
```

Each concern has `key`, `level` (0–3 or null), `confidence` (`low | medium | high`), `zones` and a bounded cosmetic note. Valid zones: `forehead`, `nose`, `cheeks`, `chin`, `under-eye`. A null level requires low confidence and empty zones. Optional improvement tips may accompany a partial result.

An in-flight result is saved only if the original profile generation and exact analysis consent remain valid. A stale result returns a conflict rather than becoming an offline success.

## History and daily use

| Method and path | Contract |
| --- | --- |
| `GET /scans?cursor=...&limit=30` | `{scans,nextCursor,totalCount}`; default 30, max 50, owner scoped |
| `GET /scans?id=<uuid>` | `{scans:[scan]}` for an individually owned label, otherwise 404 |
| `POST /routine` | `{date:"YYYY-MM-DD",slot:"AM"\|"PM",step,done:boolean}` → `{ok:true}` |
| `POST /shelf` | `{name,step,productId?,hasActive?}` → `{item}` |
| `DELETE /shelf` | `{id}` → `{ok:true}`; only the owner’s matching item is removed |

Routine dates use India-local calendar validation: real dates, today or within the previous 365 days. Steps: `cleanser | treatment | moisturiser | sunscreen`. Known catalogue products are matched on the server. Custom products are not assumed to satisfy fragrance/pregnancy restrictions. The shelf holds up to 50 entries.

Cursors encode creation timestamp and ID. They are pagination positions, not credentials; the server still scopes every page by identity. Labels are addressable in the UI at `/label?scan=<uuid>`.

## Photos and account data

| Method and path | Contract |
| --- | --- |
| `GET /photos?cursor=...&limit=30` | `{photos,nextCursor,totalCount}`; metadata only |
| `GET /photos?id=<uuid>` | Owned private JPEG, or 404 |
| `POST /photos` | `{scanId,image:JPEGDataURL}` → `{photo}`; requires owned scan, profile and current opt-in |
| `DELETE /photos` | `{id}` → `{ok:true}` |
| `GET /export` | Owned rows, own events and photo metadata; no internal object keys or other users’ rows |
| `DELETE /account` | `{confirm:"DELETE"}` → `{ok:true}` after app-data and photo deletion |

Export is JSON; photos are downloaded individually through their private endpoint. Deleting app data does not delete the sign-in provider account. An R2 failure is reported for retry rather than claiming objects were removed.

## Waitlist, invitations and events

| Method and path | Contract |
| --- | --- |
| `POST /waitlist` | `{email,price?:"49"\|"99"\|"199"\|"wouldnt_pay",ref?}` → `{ok:true}` |
| `DELETE /waitlist` | `{}` → `{ok:true}`; removes membership without deleting other app data |
| `GET /invite` | `{code,signups}` after age confirmation |
| `POST /invite` | `{ref:"16-hex-code"}`; first valid attribution wins |
| `POST /events` | `{name}` from the client allowlist; no arbitrary event properties |
| `GET /go/<product-id>` | Validate approved HTTPS store, record product click, redirect |

Client-event allowlist: `check_started`, `quiz_done`, `camera_denied`, `capture_ok`, `install_hint_seen`, `label_shared`. Other events are written by server flows. Invite codes contain no account ID; a signed-in referral is counted separately from a guest visit.

## Founder endpoints

Every endpoint below requires server-verified founder access.

| Method and path | Contract |
| --- | --- |
| `GET /admin` | Aggregate funnel, daily scans, retention, clicks, waitlist/referrals, catalogue, cap, operator/support details and access-design information |
| `PATCH /admin` | `{dailyScanCap:0..10000}` |
| `POST/PATCH /admin/products` | Complete validated `Product` object; see [types](../src/domain/types.ts) and [validation](../src/server/validation.ts) |
| `PATCH /admin/site` | `{operatorName,supportEmail}`; strings can be cleared; only validated contact fields are exposed to legal pages |

Product writes enforce cosmetic scope, active-ingredient flags, price-band consistency, approved HTTPS stores and sunscreen SPF. Secrets, roles and arbitrary settings are never exposed through the public catalogue.
