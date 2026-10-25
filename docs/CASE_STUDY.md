# Product case study

[Back to README](../README.md)

## The challenge

Build a phone-first skincare product for adults in India that can turn a short quiz and an optional selfie into a small, affordable routine. The starting brief proposed camera analysis, products in three ₹ budgets, daily routine ticks, a shelf of owned products, and a founder dashboard.

The engineering challenge was broader than making a model return JSON. The app needed to remain useful when the camera was blocked, the photo was imperfect, the provider was unavailable, consent changed during a request, or a visitor continued from a guest session after sign-in.

## Product decisions

| Decision | Reason | Consequence |
| --- | --- | --- |
| Quiz works without AI | Guidance should remain available during provider outages or without photo consent | Quiz results contain no fabricated photo findings |
| Code selects products | Model-generated shopping lists are hard to constrain and reproduce | Catalogue changes and ranking can be reviewed and tested |
| Confidence belongs on every concern | One photo can show some areas and hide others | Unreadable data is explicit, not a reassuring zero |
| Reuse owned products | A helpful routine should not always create a shopping basket | Shelf coverage suppresses duplicate product suggestions |
| Keep payments gated | Willingness to pay and repeat use are unproven | Pro remains a waitlist with no checkout or subscription |
| Keep photos optional | Saving a face is a separate choice from analysing it | Photo storage has separate consent and deletion paths |

## A concrete failure and correction

An early version rejected photos whenever blur, lighting, or framing fell outside strict rules. Both the local checker and the model could stop the flow, even when a user could see a usable face. Returning to the camera with a generic “clearer photo” message made the product frustrating on ordinary devices.

The correction changed the full path:

1. Camera startup and the optional detector load independently. An unavailable detector does not disable upload.
2. A single detected face is framed with context. Uncertain detection preserves the original frame. No beauty filter or invented detail is added.
3. Quality checks provide suggestions, not eligibility gates.
4. The AI assesses the main foreground face and each concern independently. Missing detail is represented by `level: null`, low confidence, and no inferred zones.
5. The label, history, comparison and share card preserve that uncertainty. Only medium/high-confidence observations influence photo-based focus areas.
6. A photo with no usable subject still completes with an explicitly labelled quiz routine.
7. A bounded quality review preserves the first valid assessment if the next request hits a rate limit.

A live clear public portrait produced six assessable concerns. A deliberately dim, blurred, 240-pixel-wide JPEG completed as a photo assessment with six unreadable concerns. The difference demonstrates uncertainty handling, not accuracy or a way to recover information absent from the image. The provider also made an incorrect initial subject-count assessment during testing; valid JSON alone is not evidence of correct visual interpretation.

## Reliability work behind the screens

The implementation separates product and model failure paths. A network failure can offer an honest offline quiz routine. A rejected session, consent change, invalid request or stale result cannot be converted into an offline success.

For long-running photo requests, the server records the original profile generation and consent. It checks them again when saving. If account data was deleted, or consent was withdrawn and re-granted while the provider was running, the old result is discarded. Photo upload similarly checks the original opt-in after writing to storage and cleans up an object whose permission changed.

Account deletion closes the profile before storage work so concurrent mutations cannot reopen it. Quotas reserve attempts atomically; an anonymous aggregate survives deletion so removing personal records cannot reset the global cost cap.

History uses timestamp-and-ID cursors. A regression test traverses 237 labels, including tied timestamps and a new insertion between pages, without duplicates or another owner’s records.

## Design as part of the product

The visual system uses a printed cosmetic label and shade-card motif: mint page tiles, paper-like labels, six named swatches with letter codes, monospaced data and a patch-test sticker. Color is not the only concern identifier. Self-hosted fonts avoid an external font request during normal app use.

The product includes a mobile bottom bar, a desktop workspace, focus-managed dialogs, reduced-motion behavior, and loading/empty/error states. Sharing creates a label-only image rather than a face-based before/after claim.

## What this demonstrates

- Translating a product brief into a complete user loop and persistent data model.
- Keeping AI observation separate from deterministic business rules.
- Designing useful degraded experiences rather than treating every failure as an error screen.
- Reasoning about consent, deletion, concurrency, quotas and trust boundaries.
- Connecting commercial hypotheses to measurable events without inventing traction.
- Using automated tests, browser checks and limited real-provider probes to examine different failure classes.

## What remains unproven

This is a portfolio implementation and access-restricted pilot, not a clinically validated product or a demonstrated business. Real-device camera/install/share acceptance, performance across varied people and lighting, legal/operator review, catalogue maintenance and commercial validation remain work items. See [roadmap](ROADMAP.md) and [test evidence](TESTING.md).
