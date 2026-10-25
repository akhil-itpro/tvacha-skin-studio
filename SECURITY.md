# Security policy

## Reporting a vulnerability

Use GitHub’s **Report a vulnerability** option in this repository’s Security tab. Private vulnerability reporting is the intended channel. If it is unavailable, open a minimal issue asking the maintainer for a private contact without sharing the vulnerability, user data or exploit details.

Include affected version/commit, the boundary that fails, a minimal synthetic reproduction and the likely impact. Do not include real selfies, health information, secrets, session cookies, production exports or another person’s records.

## Scope

Relevant boundaries include trusted platform identity, owner-scoped reads/writes, founder authorization, same-origin mutation checks, image/provider validation, consent/deletion races, private object access, quotas and approved product redirects.

The hosted gateway is part of the authentication boundary. An arbitrary Worker endpoint that accepts spoofable identity headers is not the supported production configuration. See [architecture](docs/ARCHITECTURE.md#identity-and-hosting-dependency).

## Expectations and limits

This is a portfolio project and pilot, without a published support SLA, bounty program, independent security certification or clinical validation. Automated tests and pattern-based repository scans are useful evidence but do not establish complete security or regulatory compliance.

If a secret is exposed, revoke/rotate it promptly; removing it from the latest file does not remove prior Git history or logs. Coordinate any history remediation with collaborators. Keep proof-of-concept testing to accounts/data you control and use synthetic fixtures.

See [data/privacy](docs/DATA_AND_PRIVACY.md) for implemented safeguards and [operations](docs/OPERATIONS.md) for release and incident handling.
