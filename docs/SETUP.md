# Local setup and configuration

[Back to README](../README.md)

## Requirements

- Node.js 24 recommended; `package.json` requires at least 22.13. The tests use Node’s SQLite module.
- npm, Git and a platform supported by the locked Cloudflare/Vite native dependencies.
- No database server, AI key or production account for the local quiz experience.

The repo includes a lockfile and a portable install/build wrapper. Do not run concurrent dependency installers. Generated runtime data stays in ignored `.sites-runtime/`, `.wrangler/` and `dist/` directories.

## Install and build

```sh
git clone https://github.com/akhil-itpro/tvacha-skin-studio.git
cd tvacha-skin-studio
npm run install:ci
npm run build
```

PowerShell users can use `npm.cmd` if execution policy blocks the `npm.ps1` shim. Use `Set-Location tvacha-skin-studio` in place of `cd` if preferred. The build generates `dist/server/wrangler.json`, used by the local database commands below.

## Initialize a fresh local database

Run each migration once, in order, against a **fresh** local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_next_stephen_strange.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_spotty_marten_broadcloak.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_military_dazzler.sql
```

These commands use local emulation and do not change hosted data. Do not replay them against an already migrated database: they contain schema creation statements. To update an existing checkout, identify and apply only unapplied migrations. The initial catalogue/rules/default cap are seeded idempotently when the catalogue is requested; request handlers never create tables.

## Start development

```sh
npm run dev
```

Open `http://127.0.0.1:5173` and allow the initial state request to finish. The development server must stay running. Use the printed port if a different port is selected. Do not expose the development mock sign-in to the internet.

Start with a quiz-only routine. Labels, shelf items, ticks and consent use local D1. Local private photos use local R2 when enabled. Production and local records are independent.

### Local sign-in and founder view

The loopback development route `/signin-with-chatgpt?return_to=/me` uses the starter’s local test identity, `user:local_seedy`. It is not production authentication. To inspect founder tools locally, put this in an ignored `.dev.vars` file and restart development:

```dotenv
ADMIN_USER_IDS=user:local_seedy
```

Sign in with the local link and visit `/admin`. In production, allow only the actual trusted platform user ID or trusted sign-in email. Do not copy the development identity into a production allowlist.

## Optional photo AI

Copy the blank example into the ignored development secret file:

```sh
cp .env.example .dev.vars
```

In PowerShell:

```powershell
Copy-Item -LiteralPath .env.example -Destination .dev.vars
```

Edit `.dev.vars` locally; never commit the filled values:

```dotenv
PHOTO_AI_PROVIDER=groq
GROQ_API_KEY=your_server_only_key
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_ZDR_ENABLED=false
ADMIN_USER_IDS=
ADMIN_EMAILS=
```

Verify the provider’s current terms, plan and retention controls. Enable **Inference APIs ZDR** in the Groq account before changing `GROQ_ZDR_ENABLED` to `true`. The flag is an operator assertion, not independent verification of provider settings. A repository clone has no access to the pilot’s existing provider secret.

The adapter also supports Gemini, but requires `GEMINI_DATA_POLICY=paid` and a suitable project before personal photo processing. There is no automatic cross-provider failover. See the [provider documentation](https://console.groq.com/docs/your-data) and [Google terms](https://ai.google.dev/gemini-api/terms); review the current requirements rather than relying on a portfolio setup date.

Restart the local server after secret changes. Missing or unavailable photo AI leaves quiz routines usable. Do not use `VITE_`, `NEXT_PUBLIC_` or another browser-exposed prefix for secrets.

## Environment reference

| Variable | Local / hosted meaning |
| --- | --- |
| `PHOTO_AI_PROVIDER` | `groq` or `gemini`; default follows available configuration |
| `GROQ_API_KEY` | Server secret; no committed default |
| `GROQ_MODEL` | Adapter default `qwen/qwen3.8-27b` |
| `GROQ_ZDR_ENABLED` | Must equal `true` after operator verification |
| `GEMINI_API_KEY` | Optional alternative server secret |
| `GEMINI_MODEL` | Adapter default `gemini-3.8-flash` |
| `GEMINI_DATA_POLICY` | Must equal `paid` to enable the Gemini path |
| `ADMIN_USER_IDS` | Comma-separated trusted server owner IDs |
| `ADMIN_EMAILS` | Exact trusted platform email allowlist |

The D1 binding is `DB`; the R2 binding is `BUCKET`. The global scan cap is a database setting edited in `/admin`, initially 20 attempts per UTC day.

## Production-build preview

After building and initializing the local database:

```sh
npm start
```

This runs the built Worker locally on loopback. It does not emulate the development sign-in. The `npm run dev` path is the appropriate local account/admin workflow.

## Common problems

| Symptom | Check |
| --- | --- |
| App shell loads, state fails | Run the initial build and apply all three migrations to the fresh local database |
| Camera blocked | Use localhost or hosted HTTPS; upload is available independently of the optional detector |
| Optional face guide fails | Check network access to detector assets; upload and capture remain usable |
| AI shown as disconnected | Confirm `.dev.vars`, exact variable names and retention flag; restart the server |
| Only quiz guidance returned | Check provider availability, daily limits, schema validation and photo readability; do not add fake scores |
| Founder access denied | Sign in; use the actual server owner ID/allowlist; restart after local secret changes |
| Duplicate table migration error | The migration was already applied; do not delete user data or replay schema files blindly |
| Installation/native dependency error | Check the locked Node/npm/platform requirements and use `npm run install:ci` before changing versions |

For hosted deployment and the existing Site identity, read [operations](OPERATIONS.md). For the complete verification sequence, read [testing](TESTING.md).
