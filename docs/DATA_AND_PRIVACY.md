# Data ownership, privacy and trust boundaries

[Back to README](../README.md) · [Security reporting](../SECURITY.md)

## Data model

The schema has 16 tables. Relationships are enforced by application logic and owner-scoped queries; the schema does not declare PostgreSQL-style RLS or a full foreign-key model.

| Table | Purpose | Access boundary |
| --- | --- | --- |
| `profiles` | Adult confirmation, quiz, profile generation | Current server owner |
| `consents` | Versioned, timestamped choices per purpose | Current server owner |
| `scans` | Quiz snapshots, cosmetic JSON, model, message | Current server owner |
| `routine_ticks` | Date/AM-PM/step completion | Current server owner; composite uniqueness |
| `shelf_items` | Owned products or custom names | Current server owner |
| `progress_photos` | Private R2 object metadata and owned scan | Current server owner plus saving consent |
| `waitlist` | Optional Pro contact and price preference | Current server owner; aggregate founder views |
| `events` | Allowlisted app/product activity | Server-owned insertion; own export; founder aggregates |
| `scan_reservations` | Personal daily attempt reservations | Server only, scoped by owner/day |
| `invites` | Opaque invite and first referring code | Current server owner |
| `referral_signups` | Signed-in referral attribution | Server-owned attribution; own deletion |
| `products` | Validated catalogue JSON and active flag | Shared reads; admin writes |
| `rules` | Concern-to-ingredient mapping | Shared validated reads; server seed |
| `settings` | Global cap and operator contact configuration | Server/admin; only selected validated contact fields shared |
| `user_roles` | Explicit founder role | Server/admin checks; no public self-promotion |
| `scan_daily_usage` | Anonymous global attempt total | Server only; retained independently of personal deletion |

## Photo lifecycle

1. The visitor confirms adulthood and makes separate unticked choices for analysis and saving progress photos.
2. Camera/upload preparation and optional framing run on the device. The image is not sent to MediaPipe for detection.
3. Selecting analysis sends the prepared JPEG through the app server to the configured provider. The app does not write an ordinary analysis image to permanent storage or application logs.
4. Validated cosmetic JSON can be saved. Unreadable concerns remain explicit nulls; rejected model text is not shown as a trusted finding.
5. Only the separate progress-photo opt-in enables private R2 persistence. Reads resolve an owned metadata record; there is no public bucket URL in a response or export.
6. The owner can delete one photo or withdraw saving consent to delete all saved photos. Export includes photo metadata; individual images have separate private downloads.

Groq retention controls are configured in the provider account; the app’s environment flag is an assertion that the operator verified that setup. It cannot guarantee provider behavior or detect a later console change. Optional Gemini personal-photo processing requires its configured paid-service data policy. Provider terms and legal obligations still apply.

## Authentication and authorization

The hosted gateway establishes the sign-in identity. The app never accepts a browser-supplied JSON owner ID as authority. Guest identities use an HttpOnly, SameSite=Lax cookie, marked Secure on HTTPS. Signing in migrates the current guest space; account-owned conflicting records win.

The gateway’s identity headers are trusted only inside that deployment boundary. A standalone deployment must validate its own session/JWT and prevent identity-header spoofing. See [architecture](ARCHITECTURE.md#identity-and-hosting-dependency).

Founder APIs deny guests and normal accounts. Access requires an explicit server allowlist or database role. Catalogue URLs are checked against an HTTPS store allowlist; opening a product cannot become an arbitrary external redirect.

## Writes, races and deletion

JSON mutations require the same-origin request header and a bounded body. Strict request schemas reject unknown fields. Routine dates must be real calendar dates within the accepted India-local interval.

Long-running analysis and storage work use the original profile generation and exact original consent. Deleting/recreating an account or withdrawing/re-granting consent cannot authorize an old in-flight result. Account deletion closes the profile before storage work, preventing stale mutations from restoring rows. An upload whose permission changed is removed after the post-write check.

Deletion removes owned application records, roles, invitation records and stored photos. A storage failure is reported for retry; the UI does not pretend deletion succeeded. Removing personal scan reservations does not reset the anonymous global attempt count.

## Minimization and known limits

- No ad pixels, session recordings or face photos in share cards.
- Fonts are served locally. Optional detector/model assets load from external hosts, which receive connection metadata; MediaPipe may collect utilization/performance metrics under its own terms.
- The service worker caches only generic public offline assets. It excludes private app HTML, auth, APIs and photos.
- Records currently remain until deletion; there is no automatic dormant-account retention job.
- Cookie clearing creates a new guest identity. The personal guest quota is not a complete anti-abuse system.
- JSON validation and confidence labels do not prove photo accuracy, security certification or regulatory compliance.
- No real visitor data, selfies, filled secret files, local D1/R2 state or deployment archives belong in this repository.

The in-app legal notices remain DRAFT. Before a public service launch, the operator must complete contact, grievance/support, retention, legal and incident-response work appropriate to the deployment. This document describes implemented controls and gaps; it is not a compliance certification.
