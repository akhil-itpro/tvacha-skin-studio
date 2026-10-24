import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { isSameOrigin } from './validation';
import { PROFILE_GENERATION_EXISTS } from './guards';
export { PROFILE_GENERATION_EXISTS } from './guards';

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export function db(): D1Database { if (!env.DB) throw new HttpError(503, 'The database is unavailable. Please try again shortly.'); return env.DB; }
export type Owner = { id: string; email: string | null; name: string; isGuest: boolean; cookie: string | null; generation?:string };
export function generationArgs(current:Owner):[string,string] {
  if(!current.generation)throw new HttpError(409,'Your space changed. Please refresh and try again.');
  return [current.id,current.generation];
}
export function requireWrite(result:D1Result) {
  if(!result.meta.changes)throw new HttpError(409,'Your data changed while this request was running. Please refresh and try again.');
}
export async function owner(request: Request): Promise<Owner> {
  const user = await getChatGPTUser();
  const cookieId = request.headers.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith('tvacha_guest='))?.slice(13);
  const validGuest = cookieId && /^[a-f0-9-]{36}$/.test(cookieId) ? 'guest:' + cookieId : null;
  if (user) {
    const ownerId = 'user:' + user.userId;
    if (validGuest) await migrateGuest(validGuest, ownerId);
    return { id: ownerId, email: user.email, name: user.fullName || user.displayName, isGuest: false, cookie: validGuest ? 'tvacha_guest=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' : null };
  }
  const guestId = validGuest || 'guest:' + id();
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return { id: guestId, email: null, name: 'Your space', isGuest: true, cookie: validGuest ? null : `tvacha_guest=${guestId.slice(6)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}` };
}
const OWNED_TABLES = ['profiles','consents','scans','routine_ticks','shelf_items','events','progress_photos','waitlist','scan_reservations','invites','referral_signups'] as const;
async function migrateGuest(guestId: string, userId: string) {
  const database = db();
  // Conflict rows already belonging to the account win; never move account-owned rows to a guest.
  const statements = OWNED_TABLES.flatMap(table => [
    database.prepare(`UPDATE OR IGNORE ${table} SET owner_id = ? WHERE owner_id = ?`).bind(userId, guestId),
    database.prepare(`DELETE FROM ${table} WHERE owner_id = ?`).bind(guestId),
  ]);
  await database.batch(statements);
}
export async function isAdmin(current: Owner): Promise<boolean> {
  if (current.isGuest) return false;
  const ids = env.ADMIN_USER_IDS?.split(',').map(v => v.trim()).filter(Boolean) || [];
  if (ids.includes(current.id) || ids.includes(current.id.slice(5))) return true;
  const role = await db().prepare('SELECT role FROM user_roles WHERE owner_id = ?').bind(current.id).first<{role:string}>();
  return role?.role === 'admin';
}
export async function requireAdmin(current: Owner) { if (!await isAdmin(current)) throw new HttpError(403, 'This page is only available to a Tvacha administrator.'); }
export async function body(request: Request, maxBytes = 24_000): Promise<Record<string, unknown>> {
  if (!isSameOrigin(request)) throw new HttpError(403, 'Please make this request from Tvacha.');
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'Send JSON data.');
  const reader = request.body?.getReader(); if (!reader) throw new HttpError(400, 'Missing request data.');
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break; total += chunk.value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new HttpError(413, 'This photo or request is too large.'); } chunks.push(chunk.value);
  }
  try {
    const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); return parsed;
  } catch { throw new HttpError(400, 'The request could not be read. Please try again.'); }
}
export function json(value: unknown, current?: Owner, status = 200): Response {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' });
  if (current?.cookie) headers.set('set-cookie', current.cookie);
  return new Response(JSON.stringify(value), { status, headers });
}
export async function event(current: Owner, name: string, properties: Record<string, string | number | boolean> = {}) {
  if(current.generation)await db().prepare(`INSERT INTO events (id,owner_id,name,properties,created_at) SELECT ?,?,?,?,? WHERE ${PROFILE_GENERATION_EXISTS}`).bind(id(),current.id,name,JSON.stringify(properties),now(),...generationArgs(current)).run();
  else await db().prepare('INSERT INTO events (id, owner_id, name, properties, created_at) VALUES (?, ?, ?, ?, ?)').bind(id(), current.id, name, JSON.stringify(properties), now()).run();
}
export async function latestConsents(ownerId: string) {
  const records = await db().prepare('SELECT purpose, granted FROM consents WHERE owner_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 100').bind(ownerId).all<{purpose:string;granted:number}>();
  const flags: Record<string, boolean> = {};
  for (const row of records.results) if (!(row.purpose in flags)) flags[row.purpose] = row.granted === 1;
  return { analysis: flags.analysis === true, progressPhotos: flags.progress_photos === true };
}
export async function deletePhotos(ownerId: string, onlyId?: string) {
  const rows = await db().prepare(`SELECT id, object_key FROM progress_photos WHERE owner_id = ?${onlyId ? ' AND id = ?' : ''}`).bind(...(onlyId ? [ownerId, onlyId] : [ownerId])).all<{id:string;object_key:string}>();
  if (rows.results.length && !env.BUCKET) throw new HttpError(503, 'Photo storage is unavailable. Please retry deletion shortly.');
  if (env.BUCKET) for (const row of rows.results) await env.BUCKET.delete(row.object_key);
  await db().prepare(`DELETE FROM progress_photos WHERE owner_id = ?${onlyId ? ' AND id = ?' : ''}`).bind(...(onlyId ? [ownerId, onlyId] : [ownerId])).run();
}
export async function deleteAccount(ownerId: string) {
  await deletePhotos(ownerId);
  await db().batch([...OWNED_TABLES, 'user_roles'].map(table => db().prepare(`DELETE FROM ${table} WHERE owner_id = ?`).bind(ownerId)));
}
