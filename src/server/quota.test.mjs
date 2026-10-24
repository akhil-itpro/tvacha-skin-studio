import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { INITIALIZE_DAY, RESERVE_SCAN, INCREMENT_DAY } from './quota.ts';

function setup() {
  const database=new DatabaseSync(':memory:');
  database.exec('CREATE TABLE scan_daily_usage(day TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0);CREATE TABLE scan_reservations(id TEXT PRIMARY KEY,owner_id TEXT,day TEXT,created_at TEXT)');
  const day='2026-10-24';
  const reserve=(owner,globalCap,personalCap)=>{
    const id=crypto.randomUUID();database.exec('BEGIN');
    try {
      database.prepare(INITIALIZE_DAY).run(day);
      const change=database.prepare(RESERVE_SCAN).run(id,owner,day,day,day,globalCap,owner,day,personalCap).changes;
      database.prepare(INCREMENT_DAY).run(day,id);database.exec('COMMIT');return change>0;
    }catch(error){database.exec('ROLLBACK');throw error;}
  };
  return {database,reserve};
}
test('guests receive one reservation and signed-in owners receive three',()=>{
  const {database,reserve}=setup();
  assert.equal(reserve('guest:a',20,1),true);assert.equal(reserve('guest:a',20,1),false);
  for(let i=0;i<3;i++) assert.equal(reserve('user:b',20,3),true);
  assert.equal(reserve('user:b',20,3),false);assert.equal(database.prepare('SELECT count FROM scan_daily_usage').get().count,4);database.close();
});
test('global quota remains enforced when an account deletes personal reservations',()=>{
  const {database,reserve}=setup();
  assert.equal(reserve('user:a',2,3),true);assert.equal(reserve('user:a',2,3),true);
  database.prepare('DELETE FROM scan_reservations WHERE owner_id = ?').run('user:a');
  assert.equal(reserve('user:b',2,3),false);assert.equal(database.prepare('SELECT count FROM scan_daily_usage').get().count,2);database.close();
});
test('zero cap prevents all provider work without incrementing usage',()=>{
  const {database,reserve}=setup();assert.equal(reserve('user:a',0,3),false);assert.equal(database.prepare('SELECT count FROM scan_daily_usage').get().count,0);database.close();
});
