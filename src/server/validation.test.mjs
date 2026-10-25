import test from 'node:test';
import assert from 'node:assert/strict';
import { isSameOrigin, quizSchema, productSchema, safeProductUrl, validateImage, validRoutineDate } from './validation.ts';
import { consentSchema, siteDetailsSchema } from './validation.ts';

test('consent updates require an explicit purpose and preserve omitted choices',()=>{
  assert.deepEqual(consentSchema.parse({progressPhotos:false}),{progressPhotos:false});
  assert.deepEqual(consentSchema.parse({analysis:false}),{analysis:false});
  for(const value of [{},{analysis:'yes'},{progressPhotos:true,ownerId:'other'}])assert.equal(consentSchema.safeParse(value).success,false);
});
test('operator contact fields accept a plain name and valid email or explicit clearing',()=>{
  assert.deepEqual(siteDetailsSchema.parse({operatorName:'  Tvacha  ',supportEmail:'support@example.com'}),{operatorName:'Tvacha',supportEmail:'support@example.com'});
  assert.equal(siteDetailsSchema.safeParse({operatorName:'',supportEmail:''}).success,true);
  for(const value of [{operatorName:'Name',supportEmail:'javascript:bad'},{operatorName:'Name\nNew line',supportEmail:''},{operatorName:'Name',supportEmail:'a@example.com',legalReviewed:true}])assert.equal(siteDetailsSchema.safeParse(value).success,false);
});

test('routine dates reject impossible calendar dates and future check-ins using India time',()=>{
  const now=new Date('2026-10-24T20:00:00Z');
  assert.equal(validRoutineDate('2026-10-25',now),true);
  assert.equal(validRoutineDate('2026-10-26',now),false);
  assert.equal(validRoutineDate('2026-02-30',now),false);
  assert.equal(validRoutineDate('2026-13-01',now),false);
  assert.equal(validRoutineDate('2024-10-25',now),false);
});
test('duplicate sensitivities cannot bypass quiz validation',()=>{
  assert.equal(quizSchema.safeParse({skinFeel:'dry',mainConcern:'dryness',budget:'under400',sensitivities:['fragrance','fragrance']}).success,false);
});

test('mutation origin checks reject cross-site and absent origins', () => {
  const req=(origin)=>new Request('https://tvacha.example/api/profile',{headers:origin?{origin}:{}});
  assert.equal(isSameOrigin(req('https://tvacha.example')),true);
  assert.equal(isSameOrigin(req('https://evil.example')),false);
  assert.equal(isSameOrigin(req('null')),false);
  assert.equal(isSameOrigin(req()),false);
});
test('safe product redirects cannot escape the approved HTTPS stores', () => {
  for(const value of ['javascript:alert(1)','https://reequil.com.evil.example/x','https://reequil.com@evil.example/x','http://beminimalist.co/x','https://localhost/x','https://beminimalist.co:444/x']) assert.equal(safeProductUrl(value),null);
  assert.equal(safeProductUrl('https://www.simpleskincare.in/products/wash'),'https://www.simpleskincare.in/products/wash');
  assert.equal(safeProductUrl('https://beminimalist.co/products/cleanser'),'https://beminimalist.co/products/cleanser');
});
test('quiz validates budgets, sensitivity combinations and unknown fields', () => {
  const q={skinFeel:'oily',mainConcern:'shine',budget:'under400',sensitivities:['none']};
  assert.equal(quizSchema.safeParse(q).success,true);
  assert.equal(quizSchema.safeParse({...q,budget:'unlimited'}).success,false);
  assert.equal(quizSchema.safeParse({...q,sensitivities:['none','pregnant']}).success,false);
  assert.equal(quizSchema.safeParse({...q,ownerId:'another-user'}).success,false);
});
test('photo validation rejects mislabeled, oversized and malformed uploads', () => {
  assert.equal(validateImage('data:image/png;base64,AAAA'),null);
  assert.equal(validateImage('data:image/jpeg;base64,'+'A'.repeat(2_200_001)),null);
  assert.equal(validateImage('data:image/jpeg;base64,'+btoa('not a JPEG'.repeat(30))),null);
  assert.equal(validateImage(null),null);
});
test('product editor rejects insufficient SPF and unsafe destination', () => {
  const p={id:'safe-sunscreen',name:'Daily SPF',brand:'Brand',step:'sunscreen',priceInr:399,size:'50g',ingredients:['zinc oxide'],concerns:['dark_spots'],skinTypes:['normal'],fragranceFree:true,pregnancyCaution:false,budgetBand:'under400',url:'https://beminimalist.co/products/spf',active:true,spf:50,hasActive:false,priceCheckedAt:'2026-10-24',priceNote:'Reference price',description:'Daily sunscreen'};
  assert.equal(productSchema.safeParse(p).success,true);
  assert.equal(productSchema.safeParse({...p,spf:15}).success,false);
  assert.equal(productSchema.safeParse({...p,url:'https://evil.example'}).success,false);
  assert.equal(productSchema.safeParse({...p,name:'Hydroquinone whitening cream'}).success,false);
  assert.equal(productSchema.safeParse({...p,budgetBand:'800plus'}).success,false);
});
