# 25 October 2026

Photo resilience fix: removed hard light/focus/position gates and the dependency on the optional MediaPipe download. Camera startup and the guide run independently; uploads remain available. A detected face is framed with context without changing colours or inventing detail. The original frame is retained when detection is uncertain. Small JPEGs are accepted down to a technical minimum of 32 pixels per side.

The AI now assesses the primary foreground face even in low-quality photos, permits partial results, and uses explicit null levels for unreadable concerns. Background decor and distant bystanders no longer imply automatic rejection. Quality-related rejections get one bounded review; a rate-limited review preserves the first valid assessment. Photos with no usable subject complete as a clearly labelled quiz routine rather than returning to a mandatory retake. Consent/deletion guards and server quotas remain in place.

Skin Labels, comparisons, history and shared PNGs distinguish uncertainty from a measured zero. Results include all six notes, confidence and optional next-photo tips. Only medium/high-confidence observations drive photo-based product picks.

Verification: 69 unit/regression checks, seven HTTP integration checks, TypeScript and production build. Browser upload QA used a 240-pixel-wide dim, blurred, heavily compressed public fixture and reached photo confirmation without quality gates. Real Groq requests accepted both the degraded and clear foreground-face fixtures: the degraded sample returned six explicit unreadable concerns; the clear sample returned six assessable concerns. These checks establish the flow, not the accuracy of individual cosmetic estimates. Source: public MediaPipe portrait asset at https://storage.googleapis.com/mediapipe-assets/portrait.jpg.

Completed history pagination for labels and private progress photos, accurate total counts, lower-cost eligible product alternatives, independent analysis/photo-saving consent controls, account age-gate guidance, waitlist removal and founder-editable operator/support details. Share cards now wrap long text with ellipses, use India dates, and handle share-sheet cancellation quietly; JSON downloads use an attached link for broader browser support. Legal pages remain explicitly DRAFT.

Current checks: 61 unit/regression checks and seven HTTP integration checks. See COMPLETION.md for the feature matrix, supported platform substitutions and remaining human/device acceptance work.

The hosted release now has a real Groq Free-plan connection. The key is stored only in Sites runtime secrets. Inference APIs Zero Data Retention was enabled in the provider account, and a real synthetic-image request returned a validated retake response. The server uses Qwen 3.8 27B for image input. No card, billing upgrade, or paid subscription was added.

Fixed catalogue fallback restoring deactivated products, unsuitable first shelf items preventing suitable owned matches, implicit suitability assumptions for custom products, duplicate quiz sensitivities, impossible/future routine dates, missing capture analytics, silent fallback on consent/session rejections, stale state requests, and late analysis navigation after leaving the check. Older labels now retain their own URL through refresh and bookmarks. Browser requests work on older iPhones without new AbortSignal helpers. Reading Privacy now preserves the check in a separate tab.

Deletion closes the profile before storage work; concurrent writes cannot reopen it. Photo cleanup deletes only the metadata matching objects actually removed. New checks preserve the server's photo-saving choice without silently re-granting a consent withdrawn in another tab. A changed analysis provider requires new consent.

Improved keyboard focus in the check and deletion modal, hid closed mobile navigation from keyboard/accessibility traversal, added a render error boundary, and included a user's own event records in the data export. Founder access is explicitly configured using the verified owner's trusted sign-in email.

Verification: 53 unit/regression checks, six HTTP integration checks (local D1/R2 and platform sign-in), TypeScript, production build, desktop/mobile browser QA, and one real provider request using a synthetic image. This does not establish clinical accuracy or replace acceptance testing on real Android/iPhone cameras and varied people/lighting. Legal documents remain marked DRAFT until operator and legal review.
