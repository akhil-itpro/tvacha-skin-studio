import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

// Run plain Node tests against the shared TypeScript without adding a test runner.
const modules = {};
for (const name of ['types', 'catalog', 'safety', 'recommendations']) {
  const source = await fs.readFile(new URL(`./${name}.ts`, import.meta.url), 'utf8');
  let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  code = code.replace(/from ['"]\.\/([^'"]+)['"]/g, (_, dependency) => `from '${modules[dependency]}'`);
  modules[name] = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
const { CONCERN_KEYS } = await import(modules.types);
const { PRODUCTS, RULES } = await import(modules.catalog);
const { validateAnalysis, validateQuiz, validateProduct } = await import(modules.safety);
const { buildRoutine, compareAnalyses, getFocusAreas, daysUntilRescan } = await import(modules.recommendations);
const quiz = { skinFeel: 'combination', mainConcern: 'shine', budget: '400to800', sensitivities: ['none'], redFlags: [] };
const analysis = () => ({ image_ok: true, retake_reasons: [], concerns: CONCERN_KEYS.map((key, i) => ({ key, level: i % 4, confidence: 'medium', zones: ['cheeks'], note: 'Visible in this photo. Light can change the estimate.' })) });

test('an explicitly empty catalogue never restores seed product recommendations',()=>{
  const plan=buildRoutine(quiz,null,[],[]);assert.equal(plan.products.length,0);
  assert.ok(plan.am.some(step=>step.key==='sunscreen'));assert.ok(plan.am.every(step=>step.product===null));
});
test('owned product matching tries a suitable second item after an unsuitable first one',()=>{
  const good=PRODUCTS.find(product=>product.step==='moisturiser'&&product.fragranceFree&&product.skinTypes.includes('combination'));
  const bad={...good,id:'fixture-fragranced',name:'Fragranced fixture',fragranceFree:false};
  const shelf=[{id:'first',name:bad.name,step:'moisturiser',productId:bad.id},{id:'second',name:good.name,step:'moisturiser',productId:good.id}];
  const plan=buildRoutine({...quiz,sensitivities:['fragrance']},null,shelf,[bad,...PRODUCTS]);
  assert.equal(plan.am.find(step=>step.key==='moisturiser').ownedName,good.name);
});
test('a custom product is not assumed fragrance-free or pregnancy-compatible',()=>{
  const shelf=[{id:'custom',name:'Unverified favourite',step:'moisturiser',hasActive:false}];
  for(const sensitivities of [['fragrance'],['pregnant']]){
    const plan=buildRoutine({...quiz,sensitivities},null,shelf);assert.equal(plan.am.find(step=>step.key==='moisturiser').owned,false);
  }
});

test('catalogue has 24 unique real products, complete safe fields and valid sources', () => {
  assert.equal(PRODUCTS.length, 24);
  assert.equal(new Set(PRODUCTS.map(item => item.id)).size, PRODUCTS.length);
  for (const product of PRODUCTS) {
    assert.ok(validateProduct(product), `Invalid catalogue item: ${product.id}`);
    assert.ok(!product.affiliateUrl, 'No fabricated affiliate relationship');
    assert.match(product.priceNote, /Reference/);
  }
});
test('strict analysis accepts exactly all six unique cosmetic concerns', () => {
  assert.deepEqual(validateAnalysis(analysis()), analysis());
  const duplicate = analysis(); duplicate.concerns[5].key = 'shine'; assert.equal(validateAnalysis(duplicate), null);
  const missing = analysis(); missing.concerns.pop(); assert.equal(validateAnalysis(missing), null);
});
test('analysis rejects unknown fields, zones, out-of-range levels and long notes', () => {
  for (const modify of [value => { value.diagnosis = 'anything'; }, value => { value.concerns[0].zones = ['face']; }, value => { value.concerns[0].level = 4; }, value => { value.concerns[0].note = 'word '.repeat(21); }]) {
    const value = analysis(); modify(value); assert.equal(validateAnalysis(value), null);
  }
});
test('analysis rejects medical, fairness and Unicode-obscured terms', () => {
  for (const note of ['Looks like rosacea.', 'Try whitening.', 'A fungal infection.', 'This will cure the redness.', 'Try whi\u200btening.', 'You appear age 28.', 'At 28 years old.', 'Your skin is brown.', 'Looks like Asian skin.']) {
    const value = analysis(); value.concerns[0].note = note; assert.equal(validateAnalysis(value), null, note);
  }
});
test('retake results need reasons and do not become photo routines', () => {
  const value = analysis(); value.image_ok = false;
  assert.equal(validateAnalysis(value), null);
  value.retake_reasons = ['Face a window and try again.']; assert.ok(validateAnalysis(value));
  assert.equal(buildRoutine(quiz, value).source, 'quiz');
});
test('quiz validation rejects contradictory sensitivities and arbitrary concern keys', () => {
  assert.ok(validateQuiz(quiz));
  assert.equal(validateQuiz({ ...quiz, sensitivities: ['none', 'pregnant'] }), null);
  assert.equal(validateQuiz({ ...quiz, mainConcern: 'cancer' }), null);
  assert.equal(validateQuiz({ ...quiz, budget: '__proto__' }), null);
});
test('red flags stop all routines and all product suggestions', () => {
  const result = buildRoutine({ ...quiz, redFlags: ['A sore that will not heal'] }, analysis());
  assert.equal(result.stopped, true); assert.equal(result.products.length, 0); assert.equal(result.am.length, 0); assert.equal(result.pm.length, 0);
});
test('fallback provides an honest quiz-based routine without photo scores', () => {
  const result = buildRoutine(quiz, null);
  assert.equal(result.source, 'quiz'); assert.equal(result.focusAreas[0].key, quiz.mainConcern); assert.equal(result.focusAreas[0].confidence, undefined);
  assert.ok(result.am.some(step => step.key === 'sunscreen'));
});
test('under 400 budget never exceeds budget including alternatives', () => {
  const result = buildRoutine({ ...quiz, budget: 'under400' });
  for (const step of [...result.am, ...result.pm]) {
    if (step.product) assert.ok(step.product.priceInr < 400);
    assert.ok((step.alternatives ?? []).every(product => product.priceInr < 400));
  }
});
test('fragrance restriction applies to every pick and alternative', () => {
  const result = buildRoutine({ ...quiz, skinFeel: 'dry', sensitivities: ['fragrance'] });
  assert.ok(result.products.every(product => product.fragranceFree));
  assert.ok([...result.am, ...result.pm].flatMap(step => step.alternatives ?? []).every(product => product.fragranceFree));
});
test('pregnancy omits flagged sunscreens, acids and new treatments', () => {
  const result = buildRoutine({ ...quiz, sensitivities: ['pregnant'] });
  assert.ok(result.products.every(product => !product.pregnancyCaution && !product.hasActive));
  assert.ok(!result.pm.some(step => step.key === 'treatment'));
  assert.match(result.notes.join(' '), /check with your doctor/i);
});
test('pregnancy low-budget sunscreen gap is explicit, never filled with a restricted product', () => {
  const result = buildRoutine({ ...quiz, budget: 'under400', sensitivities: ['pregnant', 'fragrance'] });
  const sunscreen = result.am.find(step => step.key === 'sunscreen');
  assert.ok(sunscreen); assert.equal(sunscreen.product, null); assert.match(sunscreen.budgetNote, /No suitable/);
});
test('redness focuses suppress active treatments and require fragrance-free picks', () => {
  const value = analysis(); value.concerns.forEach(concern => { concern.level = concern.key === 'redness' ? 3 : 0; });
  const result = buildRoutine(quiz, value);
  assert.ok(!result.pm.some(step => step.key === 'treatment')); assert.ok(result.products.every(product => product.fragranceFree));
});
test('owned steps are not sold again and an existing active prevents another', () => {
  const shelf = [{ id: 'a', name: 'My cleanser', step: 'cleanser' }, { id: 'b', name: 'My active', step: 'treatment', hasActive: true }];
  const result = buildRoutine(quiz, null, shelf);
  assert.ok(result.am.find(step => step.key === 'cleanser').owned);
  assert.equal(result.am.find(step => step.key === 'cleanser').product, null);
  assert.ok(!result.products.some(product => product.step === 'treatment'));
});
test('AM/PM limits, mandatory sunscreen, one new active and deterministic output across combinations', () => {
  for (const skinFeel of ['oily', 'combination', 'normal', 'dry']) for (const mainConcern of CONCERN_KEYS) for (const budget of ['under400', '400to800', '800plus']) {
    const input = { ...quiz, skinFeel, mainConcern, budget };
    const result = buildRoutine(input);
    assert.ok(result.am.length <= 4); assert.ok(result.pm.length <= 3);
    assert.ok(result.am.some(step => step.key === 'sunscreen'));
    assert.ok(result.products.filter(product => product.hasActive).length <= 1);
    assert.equal(new Set(result.am.map(step => step.key)).size, result.am.length);
    for(const step of [...result.am,...result.pm])for(const alternative of step.alternatives||[]){
      assert.ok(step.product && alternative.priceInr < step.product.priceInr);
      assert.equal(alternative.step,step.key);
    }
    assert.deepEqual(result, buildRoutine(input));
  }
});
test('low-confidence concern is omitted and equal levels prioritize stated concern', () => {
  const value = analysis(); value.concerns.forEach(concern => { concern.level = 2; concern.confidence = concern.key === 'redness' ? 'low' : 'high'; });
  const focus = getFocusAreas({ ...quiz, mainConcern: 'under_eye' }, value);
  assert.equal(focus.length, 3); assert.equal(focus[0].key, 'under_eye'); assert.ok(!focus.some(item => item.key === 'redness'));
});
test('zero visible levels do not manufacture a concern or recommend an active', () => {
  const value = analysis(); value.concerns.forEach(concern => { concern.level = 0; });
  const result = buildRoutine(quiz, value); assert.equal(result.focusAreas.length, 0); assert.ok(!result.products.some(product => product.hasActive));
});
test('comparison labels uncertainty and direction consistently', () => {
  const old = analysis(); const next = analysis();
  next.concerns[0].level = 3; next.concerns[1].level = 0; next.concerns[3].confidence = 'low';
  const result = compareAnalyses(next, old);
  assert.equal(result[0].change, 'worse'); assert.equal(result[1].change, 'better'); assert.equal(result[2].change, 'same'); assert.equal(result[3].change, 'not sure');
});
test('inactive and restricted catalogue overrides never enter recommendations', () => {
  const unsafe = { ...PRODUCTS[0], name: 'Hydroquinone cream', step: 'treatment', id: 'unsafe' };
  assert.equal(validateProduct(unsafe), null);
  const inactive = PRODUCTS.map(product => ({ ...product, active: false }));
  const result = buildRoutine(quiz, null, [], [...inactive, unsafe]); assert.equal(result.products.length, 0); assert.ok(result.am.find(step => step.key === 'sunscreen'));
});
test('catalogue editing cannot disguise an exfoliant or treatment by clearing active flags', () => {
  const exfoliant = PRODUCTS.find(product => product.id === 'minimalist-salicylic-cleanser');
  assert.equal(validateProduct({ ...exfoliant, hasActive: false }), null);
  assert.equal(validateProduct({ ...exfoliant, pregnancyCaution: false }), null);
  const treatment = PRODUCTS.find(product => product.step === 'treatment');
  assert.equal(validateProduct({ ...treatment, hasActive: false }), null);
});
test('prescription products typed into the shelf are left out of cosmetic routine', () => {
  for (const name of ['Tretinoin cream', 'Clobetasol cream', 'Adapalene gel', 'Clindamycin gel', 'Hydrocortisone cream']) {
    const result = buildRoutine(quiz, null, [{ id: 'unsafe-shelf', name, step: 'treatment' }]);
    assert.ok(![...result.am, ...result.pm].some(step => step.ownedName === name), name);
    assert.ok(!result.products.some(product => product.hasActive), 'An existing prescription must also prevent another new active');
    assert.match(result.notes.join(' '), /professional advice/);
  }
});
test('database-supplied ingredient rules drive focus text and treatment matching', () => {
  const rules = { ...RULES, shine: { ingredients: ['vitamin C'], notes: 'A different verified ingredient rule.' } };
  const result = buildRoutine(quiz, null, [], PRODUCTS, rules);
  assert.deepEqual(result.focusAreas[0].ingredients, ['vitamin C']);
  assert.equal(result.focusAreas[0].explanation, rules.shine.notes);
  assert.ok(!result.products.some(product => product.step === 'treatment'), 'No matching vitamin C product means no unrelated treatment');
});
test('weekly rescan handles exact seven days, future scans and malformed dates', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  assert.equal(daysUntilRescan('2026-10-17T12:00:00Z', now), 0);
  assert.equal(daysUntilRescan('2026-10-23T12:00:00Z', now), 6);
  assert.equal(daysUntilRescan('invalid', now), 0);
  assert.equal(daysUntilRescan('2026-10-28T12:00:00Z', now), 7);
});
