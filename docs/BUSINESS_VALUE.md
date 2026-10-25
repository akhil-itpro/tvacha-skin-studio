# Business value and validation plan

[Back to README](../README.md)

## Customer problem

The intended user is an adult in India who wants a manageable skincare routine, has a limited budget, and is uncertain about products or influencer advice. More recommendations can increase confusion rather than improve the decision.

Tvacha’s proposed value is a smaller decision: what to use, what can be skipped, and what the photo cannot establish. Budget is per product, not a hidden total routine allowance. Shelf reuse and lower-cost alternatives help the product avoid equating more spending with better care.

## Who benefits

| Stakeholder | Proposed value | How to test it |
| --- | --- | --- |
| Consumer | Fewer unsuitable suggestions; use of existing products; visible uncertainty | Observe first-session completion, comprehension and routine follow-through |
| Catalogue/retail partner | More relevant product discovery based on declared preferences | Measure qualified clicks; measure purchases only with an approved attribution arrangement |
| Founder | A view of demand, repeat use, pricing preferences and service failures | Use the event funnel, retention cohorts and waitlist responses |
| Product/engineering team | A reusable example of bounded AI, deterministic recommendations and private data ownership | Review contracts, regression tests, architecture and deployment behavior |

These are hypotheses. The repository does not establish reduced user spending, improved skin, purchase conversion, revenue, or retention uplift.

## Business model

The current app is free to use within service limits. Products initially link to official brand stores and have no configured affiliate relationship. If an approved affiliate link is added, the adjacent disclosure changes to “We may earn a commission.” Ranking still depends on product fit and price; commission does not enter the algorithm.

Pro is a research waitlist with an optional ₹49 / ₹99 / ₹199 / “wouldn’t pay” question. It collects no payment details. Joining is not a purchase commitment and the user can leave independently of deleting app data.

## Illustrative unit economics

A simple affiliate model is:

```text
completed checks × product-click rate × attributed purchase conversion
× average order value × commission rate
```

For an arithmetic example only, suppose 1,000 checks, 20% product clicks, 5% purchase conversion, a ₹600 order and 6% commission:

```text
1,000 × 0.20 × 0.05 × ₹600 × 0.06 = ₹360
```

Every number above is an assumption, not an observed result, a market benchmark or an available partner rate. It excludes cancellations, attribution loss, reversals, hosting, AI, support and compliance costs. The point is that clicks alone do not establish a viable business.

## Measurement plan

| Question | Available evidence | Interpretation limit |
| --- | --- | --- |
| Do people begin and finish? | `check_started`, `quiz_done`, `capture_ok`, `analysis_ok`, `result_viewed` | Events can repeat; counts are not a single cohort funnel |
| Does the photo flow work? | Success, fallback, retake and low-confidence aggregates | Model confidence and successful JSON do not establish accuracy |
| Do recommendations lead to interest? | Server-side `product_click` by product | A click is not a purchase |
| Do people return? | Day-1 and Day-7 event-based return aggregates | Current dashboard uses profiles at least seven days old; both rates use that eligible cohort |
| Is there pricing interest? | Waitlist price distribution | Stated preferences are not willingness to complete payment |
| Do invitations bring accounts? | Signed-in referral attribution | An attributed account is not a paid customer or proof of incrementality |

`result_viewed` currently records successful result creation, not proof that the person actually viewed the screen. Retention uses exact UTC calendar offsets after profile creation and a recorded event as return activity. Deleted personal records leave these retained-record views; the anonymous daily usage counter is separate. These definitions matter when interpreting the dashboard.

## Cost and operational controls

Photo attempts are limited on the server to one per guest identity/day, three per signed-in owner/day, and a global cap initially set to 20 per UTC day. Provider failures count because they can still consume resources. Setting the global cap to zero pauses photo attempts while quiz routines remain useful.

Each reserved photo check may call the provider up to twice. The cap bounds app attempts rather than exact tokens, requests or currency. Free-provider limits are an operating constraint, not a production capacity guarantee. Clearing a guest cookie creates a new guest identity; the personal cap is not an abuse-proof identity system. The global cap still limits application attempts. Actual commercial operation needs current provider pricing/limits, observability, support capacity and an abuse-control plan.

## Pilot plan and decision gates

1. Recruit an explicitly consented adult pilot; keep face images out of public issues and repositories.
2. Observe whether participants understand confidence and can complete the flow on their own phones.
3. Examine product fit, shelf reuse and failed recommendations through interviews and aggregate events.
4. Compare repeat use and stated pricing interest with a pre-registered decision rule before adding payments.
5. Investigate accuracy and unequal failure patterns across devices, lighting and people before claiming quality.

The original product brief gates payment work on 300+ completed scans, 15% Day-7 return, 50+ waitlist responses with a price, payment-provider KYC and legal review. These are proposed gates, not achieved milestones. An operator should review whether the gate definitions are appropriate before using them for a launch decision.
