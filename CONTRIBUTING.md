# Contributing

Thanks for taking the time to review Tvacha. Start with [setup](docs/SETUP.md), [architecture](docs/ARCHITECTURE.md) and the [test plan](docs/TESTING.md).

## Workflow

1. Open a focused issue for a bug or proposed improvement. Describe the user problem and expected behavior.
2. Create a branch such as `fix/photo-upload-state` or `docs/setup-clarity`.
3. Keep changes scoped and use descriptive Git commits. Explain any change to AI output, catalogue rules, data ownership or consent.
4. Run `npm run docs:check`, `npm run typecheck`, `npm test` and `npm run build`. Run the HTTP suite for server/data changes.
5. Open a pull request with the behavior, validation performed, remaining limitations and screenshots when useful.

Do not claim a check passed unless you ran it, and describe skipped or untested device/provider cases. Tests of safety or ownership should verify behavior and failure paths rather than just mirror an implementation.

## Product constraints

- Cosmetic guidance for adults; symptom flags stop the scan/product flow.
- AI observes; code selects products. Never make ranking depend on commission.
- Missing detail stays explicit; never manufacture scores to complete a label.
- Analysis and photo-saving consent remain separate, versioned and withdrawable.
- Owner identity, founder access, quotas and redirects remain server decisions.
- Preserve uncertainty in UI, comparison, export and shared images.

## Data and secrets

Use synthetic fixtures or the explicit public-provider test fixture. Never attach a visitor selfie, health detail, account export, cookie, key or production database to an issue or PR. Keep filled `.dev.vars` and local D1/R2 data ignored. For vulnerabilities, use [private security reporting](SECURITY.md), not a public bug report.

## Licensing

No project-wide open-source license has been selected. Bundled third-party notices remain applicable. Ask the maintainer before contributing changes that would require a new license or redistribution right; do not add copyrighted product photos or proprietary datasets without permission.
