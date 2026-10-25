# Deployment and operations

[Back to README](../README.md)

## Deployment model

The pilot uses Sites to publish a Vinext Worker with D1 `DB`, private R2 `BUCKET` and hosted Sign in with ChatGPT. The repository is public source; the current hosted Site has restricted access. GitHub publication does not change that Site’s audience.

`.openai/hosting.json` retains the pilot’s project identity and logical binding names. The ID is not a credential and does not grant access. A fork should register its **own** Site identity and storage before publishing. Do not deploy a clone to the existing ID unless you are the authorized owner.

The preserved Sites tooling owns the production packaging/publication path. Build and push the exact source state; deploy the saved version built from that commit. Keep the archive unchanged until saving succeeds. Runtime keys belong in the hosting secret controls, not in source, screenshots or a workflow.

A standalone Cloudflare deployment needs a trusted auth implementation instead of accepting raw `oai-authenticated-*` request headers. See [architecture](ARCHITECTURE.md#identity-and-hosting-dependency). The app is not documented as an unauthenticated drop-in Worker.

## Release checklist

1. Run documentation/repository checks, TypeScript, unit tests and the production build.
2. Run the HTTP suite against migrated local D1/R2 and inspect any skipped fixtures.
3. Review changes to product rules, consent, owner scoping, deletion and private storage.
4. Confirm production provider readiness, actual data-retention controls and the intended global cap.
5. Publish through the authorized hosting workflow; record source commit, saved version and deployment result.
6. Check a controlled guest and signed-in flow on the deployed origin without adding real visitor data to test artifacts.
7. Complete device and evaluation acceptance for changes affecting photo quality, camera, install or sharing.

The GitHub verification workflow tests source; it does not deploy and needs no production credentials.

## Service controls

| Control | Operating purpose |
| --- | --- |
| Daily cap in `/admin` | Limit global photo attempts; zero pauses photo analysis while quiz routines remain usable |
| Per-owner attempts | One guest / three signed-in attempts per UTC day; provider failures still count |
| Provider config and retention gate | Disable photo transmission when required configuration is missing |
| Product active flag | Remove an item from new recommendations without erasing catalogue history |
| Operator/support form | Keep draft contact details editable without a code deployment |
| Export and deletion | Support a user’s own data access and removal requests |

Retest current provider limits and pricing when operating the service. A Free-plan setup is not an unlimited-capacity or zero-cost guarantee for hosting, storage or support.

## Handling a provider incident

Pause photo attempts with a zero cap if the provider or data-control setup needs investigation. Confirm that quiz routines remain clearly labelled. Inspect aggregate failures and the provider console without copying face images, raw prompts/responses or keys into public logs/issues. Restore photo access only after the operator verifies configuration and a controlled probe succeeds.

## Handling a catalogue issue

Deactivate the affected item, review its exact pack ingredients, size, price and cautions, then validate a corrected entry through the founder editor. Reference prices are not live retailer prices. Approved affiliate arrangements and disclosures require their own operator review; commission must not enter ranking.

## Handling a privacy/security issue

Use [SECURITY.md](../SECURITY.md) for confidential reporting. Preserve minimal incident metadata rather than adding user content to the repository. Review the relevant identity, consent generation, object ownership and deletion checks. An R2 failure must not be reported as a completed deletion. Do not disable authorization or retain face data just to simplify debugging.

A real public service still needs an operator-approved incident response process, support ownership, retention/backups policy and legal review. They are not established by this portfolio README.

## Repository hygiene

Commit source, migrations, tests and reviewed documentation. Keep `.dev.vars`, `.env` values, local databases, R2 objects, `node_modules`, generated builds, deployment archives and user exports out of Git. Use descriptive commits and feature branches for future work. Never force-push rewritten history to the shared main branch to hide an exposed secret: rotate the secret first and coordinate remediation.
