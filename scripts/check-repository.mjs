import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (git.status !== 0) throw new Error('Run the repository check inside its Git checkout.');
const files = [...new Set(git.stdout.split('\0').filter(Boolean))];
const errors = [];
const required = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md', 'docs/CASE_STUDY.md', 'docs/BUSINESS_VALUE.md', 'docs/ARCHITECTURE.md', 'docs/SETUP.md', 'docs/API.md', 'docs/DATA_AND_PRIVACY.md', 'docs/TESTING.md', 'docs/OPERATIONS.md', 'docs/ROADMAP.md', '.github/workflows/verify.yml'];
const patterns = [
  ['provider key', /\b(?:gsk_|sk-(?:proj-)?)[A-Za-z0-9_-]{20,}/],
  ['GitHub token', /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{25,}/],
  ['Google key', /\bAIza[A-Za-z0-9_-]{30,}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWS key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
];
for (const file of required) if (!files.includes(file)) errors.push('Missing portfolio file: ' + file);
const binary = /\.(?:png|jpe?g|gif|webp|ico|ttf|woff2?|pdf|zip|tar|sqlite)$/i;
let markdown = 0, localLinks = 0;
const headingCache = new Map();
async function checkLink(from, raw) {
  if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) return;
  const [rawPath, fragment] = raw.split('#');
  let target;
  try { target = decodeURIComponent(rawPath.split('?')[0]); } catch { errors.push(`${from}: invalid encoded link`); return; }
  const resolved = path.resolve(path.dirname(path.join(root, from)), target);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { errors.push(`${from}: link leaves repository: ${raw}`); return; }
  try { await fs.access(resolved); } catch { errors.push(`${from}: missing local target: ${raw}`); return; }
  localLinks++;
  if (!fragment || !/\.md$/i.test(resolved)) return;
  if (!headingCache.has(resolved)) {
    const source = await fs.readFile(resolved, 'utf8');
    const counts = new Map(), ids = new Set();
    for (const match of source.matchAll(/^#{1,6}\s+(.+)$/gm)) {
      const slug = match[1].toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').trim().replace(/\s/g, '-');
      const previous = counts.get(slug) || 0; counts.set(slug, previous + 1); ids.add(slug + (previous ? '-' + previous : ''));
    }
    headingCache.set(resolved, ids);
  }
  if (!headingCache.get(resolved).has(decodeURIComponent(fragment))) errors.push(`${from}: missing heading: ${raw}`);
}
for (const file of files) {
  const normalized = file.replaceAll('\\', '/');
  if (/(^|\/)(?:node_modules|\.wrangler|\.sites-runtime|outputs|dist)(\/|$)/.test(normalized) || /(^|\/)\.dev\.vars/.test(normalized) || (/\/(?:\.env[^/]*)$/.test('/' + normalized) && !normalized.endsWith('.env.example')) || /(?:\.pem|\.sqlite|\.db|\.har|\.cookies)$/.test(normalized) || /(?:^|\/)tvacha-(?:my-data-.+\.json|label-.+\.png)$/.test(normalized)) {
    errors.push('Private/generated path must not be published: ' + file); continue;
  }
  if (binary.test(file)) continue;
  const content = await fs.readFile(path.join(root, file), 'utf8');
  for (const [kind, pattern] of patterns) if (pattern.test(content)) errors.push(`${file}: possible ${kind}; inspect privately`);
  if (!/\.md$/i.test(file)) continue;
  markdown++;
  for (const match of content.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\)/g)) await checkLink(file, match[1] || match[2]);
  for (const match of content.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/g)) await checkLink(file, match[1]);
}
if (errors.length) { process.stderr.write(errors.join('\n') + '\n'); process.exitCode = 1; }
else process.stdout.write(`Repository check passed: ${files.length} files, ${markdown} Markdown documents, ${localLinks} local links; no flagged credential patterns or private/generated paths.\n`);
