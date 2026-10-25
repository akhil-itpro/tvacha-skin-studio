import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { historyCursor, historyOptions, historyQuery } from './history.ts';

test('history pagination traverses more than 200 labels, including timestamp ties, without repeats or another owner',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE scans(id TEXT PRIMARY KEY, owner_id TEXT, created_at TEXT)');
  const put=db.prepare('INSERT INTO scans VALUES (?,?,?)');
  for(let i=0;i<237;i++)put.run(crypto.randomUUID(),'owner-a',`2026-10-${String(1+i%24).padStart(2,'0')}T00:00:00.000Z`);
  for(let i=0;i<80;i++)put.run(crypto.randomUUID(),'owner-b','2026-10-24T00:00:00.000Z');
  const expected=db.prepare('SELECT id FROM scans WHERE owner_id = ? ORDER BY created_at DESC,id DESC').all('owner-a').map(row=>row.id);
  const seen=[];let cursor=null;
  do {
    const options=historyOptions(new URLSearchParams(cursor?{cursor}:{}));
    const c=options.cursor;
    const rows=db.prepare(historyQuery('scans',!!c)).all(...(c?['owner-a',c.createdAt,c.createdAt,c.id,31]:['owner-a',31]));
    const visible=rows.slice(0,30);seen.push(...visible.map(row=>row.id));
    assert.ok(visible.every(row=>row.owner_id==='owner-a'));
    cursor=rows.length>30?historyCursor(visible.at(-1)):null;
    if(seen.length===30)put.run(crypto.randomUUID(),'owner-a','2026-10-25T00:00:00.000Z');
  }while(cursor);
  assert.deepEqual(seen,expected);assert.equal(new Set(seen).size,237);db.close();
});

test('history rejects invalid cursors, injected fields and unbounded limits',()=>{
  for(const cursor of ['invalid', 'x'.repeat(241), btoa('{}'), btoa(JSON.stringify({createdAt:'yesterday',id:crypto.randomUUID()})), btoa(JSON.stringify({createdAt:'2026-10-25T00:00:00Z',id:crypto.randomUUID(),owner_id:'other'}))])
    assert.throws(()=>historyOptions(new URLSearchParams({cursor})));
  for(const limit of ['0','-1','51','3.5','not-a-number',''])assert.throws(()=>historyOptions(new URLSearchParams({limit})));
});

test('photo history selects metadata without exposing storage object keys',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE progress_photos(id TEXT,owner_id TEXT,scan_id TEXT,created_at TEXT,object_key TEXT)');
  db.prepare('INSERT INTO progress_photos VALUES (?,?,?,?,?)').run(crypto.randomUUID(),'a',crypto.randomUUID(),'2026-10-25T00:00:00Z','private-key');
  const row=db.prepare(historyQuery('progress_photos',false)).get('a',31);
  assert.deepEqual(Object.keys(row).sort(),['created_at','id','scan_id']);db.close();
});
