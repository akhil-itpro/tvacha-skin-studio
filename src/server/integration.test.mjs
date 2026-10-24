import test from 'node:test';
import assert from 'node:assert/strict';

const base=process.env.TVACHA_TEST_URL;
const quiz={skinFeel:'combination',mainConcern:'shine',budget:'under400',sensitivities:['none'],redFlags:[]};
function client() {
  const cookies=new Map();
  return async (path,method='GET',data,extraHeaders={})=>{
    const cookie=[...cookies].map(([key,value])=>key+'='+value).join('; ');
    const headers={...(cookie?{cookie}:{}),...extraHeaders};
    if(data!==undefined) Object.assign(headers,{'content-type':'application/json',origin:new URL(base).origin});
    const response=await fetch(new URL(path,base),{method,headers,body:data===undefined?undefined:JSON.stringify(data),redirect:'manual'});
    for(const header of response.headers.getSetCookie()){
      const pair=header.split(';')[0],split=pair.indexOf('='),key=pair.slice(0,split),value=pair.slice(split+1);
      if(/max-age=0(?:;|$)/i.test(header)||!value)cookies.delete(key);else cookies.set(key,value);
    }
    const result=response.headers.get('content-type')?.includes('application/json')?await response.json():await response.arrayBuffer();
    return {status:response.status,data:result,headers:response.headers};
  };
}

test('HTTP isolation and data lifecycle across two independent guest identities',{skip:!base},async()=>{
  const a=client(),b=client(),underage=client();
  const firstA=await a('/api/state'),firstB=await b('/api/state');
  assert.equal(firstA.status,200);assert.equal(firstB.status,200);assert.notEqual(firstA.data.user.id,firstB.data.user.id);
  assert.equal(firstA.data.user.isGuest,true);assert.equal(firstB.data.user.isGuest,true);
  assert.equal((await underage('/api/analyse','POST',{quiz,mode:'quiz'})).status,403);
  assert.equal((await a('/api/profile','POST',{ageConfirmed:true,quiz})).status,200);
  assert.equal((await b('/api/profile','POST',{ageConfirmed:true,quiz})).status,200);
  assert.equal((await a('/api/consents','POST',{analysis:true,progressPhotos:false})).status,200);
  assert.equal((await b('/api/consents','POST',{analysis:false,progressPhotos:false})).status,200);
  const resultA=await a('/api/analyse','POST',{quiz,mode:'quiz'});
  assert.equal(resultA.status,200);assert.equal(resultA.data.scan.analysis,null);assert.equal(resultA.data.scan.source,'quiz');
  assert.ok(resultA.data.routine.am.some(step=>step.key==='sunscreen'));
  assert.ok(resultA.data.routine.am.length<=4);assert.ok(resultA.data.routine.pm.length<=3);
  const date=new Date().toISOString().slice(0,10);
  assert.equal((await a('/api/routine','POST',{date,slot:'AM',step:'cleanser',done:true})).status,200);
  const shelfA=await a('/api/shelf','POST',{name:'PRIVATE OWNER A CLEANSER',step:'cleanser',hasActive:false});assert.equal(shelfA.status,200);
  const secondA=await a('/api/state'),secondB=await b('/api/state');
  assert.equal(secondA.data.scans.length,1);assert.equal(secondB.data.scans.length,0);
  assert.equal(secondA.data.ticks.length,1);assert.equal(secondB.data.ticks.length,0);
  assert.equal(secondA.data.shelf.length,1);assert.equal(secondB.data.shelf.length,0);
  assert.equal(secondA.data.consents.analysis,true);assert.equal(secondB.data.consents.analysis,false);
  await b('/api/shelf','DELETE',{id:shelfA.data.item.id});assert.equal((await a('/api/state')).data.shelf.length,1);
  assert.equal((await b('/api/photos?id='+crypto.randomUUID())).status,404);
  assert.equal((await a('/api/admin')).status,403);assert.equal((await b('/api/admin')).status,403);
  assert.equal((await b('/api/admin','PATCH',{dailyScanCap:1})).status,403);
  assert.equal((await b('/api/admin/products','POST',firstA.data.products[0])).status,403);
  assert.equal((await b('/api/profile','POST',{ageConfirmed:true,ownerId:firstA.data.user.id})).status,400);
  const unsafe=await a('/api/analyse','POST',{quiz:{...quiz,redFlags:['painful_lumps']},mode:'quiz'});assert.equal(unsafe.status,422);
  assert.equal((await a('/api/state')).data.scans.length,1);
  const exported=await a('/api/export');assert.equal(exported.status,200);assert.equal(exported.data.scans.length,1);assert.equal(exported.data.shelf_items.length,1);
  assert.equal(JSON.stringify(exported.data).includes(firstB.data.user.id),false);assert.equal('events' in exported.data,false);
  assert.equal((await a('/api/waitlist','POST',{email:'fixture-only@example.test',price:'wouldnt_pay'})).status,200);
  assert.equal((await a('/api/state')).data.waitlist,true);assert.equal((await b('/api/state')).data.waitlist,false);
  const invite=await a('/api/invite');assert.equal(invite.status,200);assert.match(invite.data.code,/^[a-f0-9]{16}$/);
  assert.equal(invite.data.code.includes(firstA.data.user.id),false);
  assert.equal((await b('/api/invite','POST',{ref:invite.data.code})).status,200);
  assert.equal((await a('/api/account','DELETE',{confirm:'DELETE'})).status,200);
  // Deletion expires the guest cookie; a new state must contain no prior owner data.
  const deleted=await a('/api/state');assert.equal(deleted.status,200);assert.equal(deleted.data.profile,null);assert.equal(deleted.data.scans.length,0);assert.equal(deleted.data.shelf.length,0);assert.equal(deleted.data.ticks.length,0);assert.equal(deleted.data.inviteCode,null);
  assert.equal((await b('/api/state')).data.profile.ageConfirmed,true);
  await b('/api/account','DELETE',{confirm:'DELETE'});
});

test('HTTP rejects cross-origin writes',{skip:!base},async()=>{
  const response=await fetch(new URL('/api/profile',base),{method:'POST',headers:{'content-type':'application/json',origin:'https://untrusted.example'},body:JSON.stringify({ageConfirmed:true})});assert.equal(response.status,403);
});

test('HTTP private R2 photos require opt-in, remain owner-only and are deleted on withdrawal',{skip:!base},async()=>{
  const {default:sharp}=await import('sharp');
  // A synthetic solid-colour JPEG; no human photo or biometric data is used in tests.
  const bytes=await sharp({create:{width:200,height:240,channels:3,background:'#e9f1ee'}}).jpeg().toBuffer();
  const image='data:image/jpeg;base64,'+bytes.toString('base64');
  const a=client(),b=client();await a('/api/state');await b('/api/state');
  await a('/api/profile','POST',{ageConfirmed:true,quiz});await b('/api/profile','POST',{ageConfirmed:true,quiz});
  await a('/api/consents','POST',{analysis:true,progressPhotos:false});await b('/api/consents','POST',{analysis:true,progressPhotos:true});
  const label=await a('/api/analyse','POST',{quiz,mode:'quiz'});assert.equal(label.status,200);
  assert.equal((await a('/api/photos','POST',{scanId:label.data.scan.id,image})).status,403);
  await a('/api/consents','POST',{analysis:true,progressPhotos:true});
  const saved=await a('/api/photos','POST',{scanId:label.data.scan.id,image});assert.equal(saved.status,200);
  const photoId=saved.data.photo.id;
  const readA=await a('/api/photos?id='+photoId);assert.equal(readA.status,200);assert.equal(readA.headers.get('content-type'),'image/jpeg');assert.deepEqual(Buffer.from(readA.data),bytes);
  assert.equal((await b('/api/photos?id='+photoId)).status,404);
  assert.equal((await b('/api/photos','POST',{scanId:label.data.scan.id,image})).status,404);
  await b('/api/photos','DELETE',{id:photoId});assert.equal((await a('/api/photos?id='+photoId)).status,200);
  assert.equal((await a('/api/state')).data.photos.length,1);assert.equal((await b('/api/state')).data.photos.length,0);
  await a('/api/consents','POST',{analysis:true,progressPhotos:false});assert.equal((await a('/api/photos?id='+photoId)).status,404);assert.equal((await a('/api/state')).data.photos.length,0);
  const connected=(await a('/api/state')).data.services.photoAnalysis;
  if(!connected){const fallback=await a('/api/analyse','POST',{quiz,mode:'photo',image});assert.equal(fallback.status,200);assert.equal(fallback.data.scan.analysis,null);assert.equal(fallback.data.scan.source,'quiz');}
  await a('/api/account','DELETE',{confirm:'DELETE'});await b('/api/account','DELETE',{confirm:'DELETE'});
});

test('HTTP refuses collecting shelf, routine, consent and waitlist before age confirmation',{skip:!base},async()=>{
  const user=client();await user('/api/state');
  for(const [path,data] of [
    ['/api/shelf',{name:'Underage test item',step:'cleanser'}],
    ['/api/routine',{date:new Date().toISOString().slice(0,10),slot:'AM',step:'cleanser',done:true}],
    ['/api/consents',{analysis:true,progressPhotos:false}],
    ['/api/waitlist',{email:'nobody@example.test'}],
  ])assert.equal((await user(path,'POST',data)).status,403);
});

test('HTTP platform sign-in and server admin role checks',{skip:!base||process.env.TVACHA_ADMIN_TEST!=='1'},async()=>{
  assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Admin fixture is local-only');
  const {spawnSync}=await import('node:child_process');
  const sql=statement=>{
    const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',statement,'--json'],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout)[0].results;
  };
  const signedIn=client();const signin=await signedIn('/signin-with-chatgpt?return_to=%2F');assert.equal(signin.status,302);
  const state=await signedIn('/api/state');assert.equal(state.data.user.isGuest,false);assert.equal(state.data.user.id,'user:local_seedy');
  const previous=sql("SELECT role FROM user_roles WHERE owner_id = 'user:local_seedy'");
  if(!previous.length)assert.equal((await signedIn('/api/admin')).status,403);
  try{
    sql("INSERT INTO user_roles (owner_id,role) VALUES ('user:local_seedy','admin') ON CONFLICT(owner_id) DO UPDATE SET role='admin'");
    const dashboard=await signedIn('/api/admin');assert.equal(dashboard.status,200);assert.ok(Array.isArray(dashboard.data.products));assert.ok(Array.isArray(dashboard.data.funnel));
    assert.equal((await signedIn('/api/admin','PATCH',{dailyScanCap:dashboard.data.dailyScanCap})).status,200);
    assert.equal((await signedIn('/api/admin/products','POST',{})).status,400);
    assert.equal((await signedIn('/api/admin/products','POST',{...dashboard.data.products.find(p=>p.step==='sunscreen'),spf:10})).status,400);
  }finally{
    if(previous.length){assert.match(previous[0].role,/^[a-z_]+$/);sql("UPDATE user_roles SET role = '"+previous[0].role+"' WHERE owner_id = 'user:local_seedy'");}
    else sql("DELETE FROM user_roles WHERE owner_id = 'user:local_seedy'");
  }
});

test('HTTP sign-in migrates a guest label and records an opaque referral signup',{skip:!base||process.env.TVACHA_ADMIN_TEST!=='1'},async t=>{
  const signedIn=client();await signedIn('/signin-with-chatgpt?return_to=%2F');const before=await signedIn('/api/state');
  if(before.data.profile||before.data.scans.length||before.data.shelf.length||before.data.photos.length||before.data.isAdmin){t.skip('The local platform test account contains existing data; preserving it.');return;}
  const inviter=client(),guest=client();await inviter('/api/state');const initialGuest=await guest('/api/state');
  await inviter('/api/profile','POST',{ageConfirmed:true});await guest('/api/profile','POST',{ageConfirmed:true,quiz});
  const invitation=await inviter('/api/invite');await guest('/api/invite','POST',{ref:invitation.data.code});
  await guest('/api/consents','POST',{analysis:true,progressPhotos:false});
  const label=await guest('/api/analyse','POST',{quiz,mode:'quiz'});assert.equal(label.status,200);
  const added=await guest('/api/shelf','POST',{name:'SIGN-IN MIGRATION FIXTURE',step:'cleanser'});assert.equal(added.status,200);
  try{
    await guest('/signin-with-chatgpt?return_to=%2F');
    const migrated=await guest('/api/state');assert.equal(migrated.data.user.isGuest,false);assert.equal(migrated.data.user.id,before.data.user.id);
    assert.ok(migrated.data.scans.some(s=>s.id===label.data.scan.id));assert.ok(migrated.data.shelf.some(s=>s.id===added.data.item.id));assert.equal(migrated.data.consents.analysis,true);
    const oldSession=await fetch(new URL('/api/state',base),{headers:{cookie:'tvacha_guest='+initialGuest.data.user.id.slice(6)}});const oldState=await oldSession.json();assert.equal(oldState.scans.length,0);assert.equal(oldState.shelf.length,0);
    assert.equal((await inviter('/api/invite')).data.signups,1);
  }finally{
    await guest('/api/account','DELETE',{confirm:'DELETE'});await inviter('/api/account','DELETE',{confirm:'DELETE'});
  }
});
