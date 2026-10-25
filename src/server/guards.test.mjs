import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { INSERT_SCAN_GUARDED, INSERT_EVENT_FOR_SCAN, PROFILE_GENERATION_EXISTS, CLOSE_PROFILE, UPSERT_PROFILE } from './guards.ts';

test('account deletion closes uploads before storage work and age confirmation cannot reopen it',()=>{
  const {db,save}=setup();db.exec('ALTER TABLE profiles ADD COLUMN quiz_json TEXT');
  assert.equal(db.prepare(CLOSE_PROFILE).run('user:a').changes,1);
  assert.equal(save(),0);
  assert.equal(db.prepare(UPSERT_PROFILE).run('user:a','new-epoch','{}').changes,0);
  assert.equal(db.prepare('SELECT age_confirmed FROM profiles').get().age_confirmed,0);
  db.exec('DELETE FROM profiles');
  assert.equal(db.prepare(UPSERT_PROFILE).run('user:a','new-epoch','{}').changes,1);
  assert.equal(save('user:a','epoch-a'),0);db.close();
});

function setup() {
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE profiles(owner_id TEXT PRIMARY KEY,age_confirmed INTEGER,created_at TEXT);CREATE TABLE consents(id TEXT PRIMARY KEY,owner_id TEXT,purpose TEXT,granted INTEGER,created_at TEXT);CREATE TABLE scans(id TEXT PRIMARY KEY,owner_id TEXT,created_at TEXT,quiz_json TEXT,result_json TEXT,source TEXT,model TEXT,message TEXT);CREATE TABLE events(id TEXT PRIMARY KEY,owner_id TEXT,name TEXT,properties TEXT,created_at TEXT)');
  db.prepare('INSERT INTO profiles VALUES (?,?,?)').run('user:a',1,'epoch-a');
  db.prepare('INSERT INTO consents VALUES (?,?,?,?,?)').run('consent-a','user:a','analysis',1,'2026-10-24T01:00:00Z');
  const save=(owner='user:a',epoch='epoch-a')=>{
    const id=crypto.randomUUID();db.exec('BEGIN');
    const changes=db.prepare(INSERT_SCAN_GUARDED).run(id,owner,'now','{}','{}','photo','gemini','',owner,epoch,'photo',owner,'consent-a',owner).changes;
    db.prepare(INSERT_EVENT_FOR_SCAN).run(crypto.randomUUID(),owner,'analysis_ok','{}','now',id,owner);db.exec('COMMIT');return changes;
  };
  return {db,save};
}
test('a valid still-current profile and consent permits a photo result',()=>{
  const {db,save}=setup();assert.equal(save(),1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM scans').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,1);db.close();
});
test('deleting an account during analysis cannot recreate scans or analytics',()=>{
  const {db,save}=setup();db.exec('DELETE FROM profiles;DELETE FROM consents');assert.equal(save(),0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM scans').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,0);db.close();
});
test('withdrawing then granting new consent discards the old in-flight result',()=>{
  const {db,save}=setup();db.prepare('INSERT INTO consents VALUES (?,?,?,?,?)').run('consent-b','user:a','analysis',0,'2026-10-24T02:00:00Z');assert.equal(save(),0);
  db.prepare('INSERT INTO consents VALUES (?,?,?,?,?)').run('consent-c','user:a','analysis',1,'2026-10-24T03:00:00Z');assert.equal(save(),0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM scans').get().n,0);db.close();
});
test('another owner cannot use the first owner consent record',()=>{
  const {db,save}=setup();db.prepare('INSERT INTO profiles VALUES (?,?,?)').run('user:b',1,'epoch-b');assert.equal(save('user:b','epoch-b'),0);db.close();
});

test('the shared mutation generation guard rejects writes after deletion or account recreation',()=>{
  const {db}=setup();db.exec('CREATE TABLE mutation_fixture(kind TEXT,owner_id TEXT)');
  const write=(kind,generation)=>db.prepare(`INSERT INTO mutation_fixture(kind,owner_id) SELECT ?,? WHERE ${PROFILE_GENERATION_EXISTS}`).run(kind,'user:a','user:a',generation).changes;
  assert.equal(write('shelf','epoch-a'),1);db.exec('DELETE FROM profiles');
  for(const kind of ['shelf','routine','consents','waitlist','invites','referral_signups','analytics'])assert.equal(write(kind,'epoch-a'),0);
  db.prepare('INSERT INTO profiles VALUES (?,?,?)').run('user:a',1,'epoch-new');
  for(const kind of ['shelf','routine','consents','waitlist','invites','referral_signups','analytics'])assert.equal(write(kind,'epoch-a'),0);
  assert.equal(write('fresh-session','epoch-new'),1);db.close();
});
