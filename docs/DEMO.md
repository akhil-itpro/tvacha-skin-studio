# Reviewer walkthrough

[Back to README](../README.md)

This is a short tour for a reviewer who wants to understand the product before reading every module. Use the [screenshots](../README.md#see-the-product) immediately, or complete [local setup](SETUP.md) to interact with the quiz experience without a provider key. The hosted pilot requires access.

## A five-minute local tour

1. **Check:** confirm the adult test flow, review the two separate unticked photo choices, and use the quiz without analysis consent. Select a budget and sensitivities, then declare no symptom flags only for an appropriate test scenario. “Build from my answers” should return a label that explicitly says no photo was assessed.
2. **Result:** inspect the routine, dated reference prices, conditional commission disclosure and lower-cost alternatives. The same inputs and catalogue should produce the same picks. A missing suitable sunscreen product remains an explained gap rather than an unsafe substitute.
3. **Shelf:** add an owned cleanser. Return to the routine/result and verify that an owned step does not create a duplicate shopping recommendation.
4. **Routine and history:** tick a step, refresh, and inspect progress. Saved labels retain their own URL. Photo comparisons say “not sure” when either observation is uncertain.
5. **Account and founder:** export the local test data, inspect separate consent controls and the Pro waitlist. For the founder view, follow the [local sign-in instructions](SETUP.md#local-sign-in-and-founder-view). Aggregates reflect retained local records; they are not a claim of real traction.

To examine photo-specific behavior, use an explicitly configured provider and controlled fixtures after reading [testing](TESTING.md#live-provider-probes). The repo never includes a ready-to-use production key.

## Read these modules next

| Question | Module |
| --- | --- |
| How do product choices stay controlled? | [Recommendation engine](../src/domain/recommendations.ts) |
| How does missing image detail stay explicit? | [Analysis adapter](../src/server/analysis-client.ts), [schema validation](../src/domain/safety.ts) |
| What happens if consent changes during analysis? | [SQL guards](../src/server/guards.ts), [API flow](../src/server/api.ts) |
| How are cost limits reserved? | [Quota transaction](../src/server/quota.ts) |
| Can another account read a saved image? | [Owner/role boundary](../src/server/core.ts), [HTTP isolation tests](../src/server/integration.test.mjs) |
| What is proven about pagination and deletion? | [History tests](../src/server/history.test.mjs), [guard tests](../src/server/guards.test.mjs) |

## Useful discussion prompts

- Why is the model not allowed to choose products?
- Why does an unreadable concern have a null level rather than level zero?
- Why must an original consent record and profile generation be checked after a long-running request?
- What can and cannot be inferred from a product click, a model confidence value or a passing test?
- What would need to change to host the app outside the trusted Sites authentication gateway?

The [case study](CASE_STUDY.md) and [business value](BUSINESS_VALUE.md) documents develop these decisions and their tradeoffs.
