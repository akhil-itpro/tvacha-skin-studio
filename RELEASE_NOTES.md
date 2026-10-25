# 25 October 2026

The hosted release now has a real Groq Free-plan connection. The key is stored only in Sites runtime secrets. Inference APIs Zero Data Retention was enabled in the provider account, and a real synthetic-image request returned a validated retake response. The server uses Qwen 3.8 27B for image input. No card, billing upgrade, or paid subscription was added.

Fixed catalogue fallback restoring deactivated products, unsuitable first shelf items preventing suitable owned matches, implicit suitability assumptions for custom products, duplicate quiz sensitivities, impossible/future routine dates, missing capture analytics, silent fallback on consent/session rejections, stale state requests, and late analysis navigation after leaving the check. Older labels now retain their own URL through refresh and bookmarks. Browser requests work on older iPhones without new AbortSignal helpers. Reading Privacy now preserves the check in a separate tab.

Deletion closes the profile before storage work; concurrent writes cannot reopen it. Photo cleanup deletes only the metadata matching objects actually removed. New checks preserve the server's photo-saving choice without silently re-granting a consent withdrawn in another tab. A changed analysis provider requires new consent.

Improved keyboard focus in the check and deletion modal, hid closed mobile navigation from keyboard/accessibility traversal, added a render error boundary, and included a user's own event records in the data export. Founder access is explicitly configured using the verified owner's trusted sign-in email.

Verification: 53 unit/regression checks, six HTTP integration checks (local D1/R2 and platform sign-in), TypeScript, production build, desktop/mobile browser QA, and one real provider request using a synthetic image. This does not establish clinical accuracy or replace acceptance testing on real Android/iPhone cameras and varied people/lighting. Legal documents remain marked DRAFT until operator and legal review.
