import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
import { wrapLines } from './text-layout.ts';
const measure = value => Array.from(value).length;
test('share labels keep all short text and wrap whole words',()=>{
  assert.deepEqual(wrapLines('  One   simple routine  ',12,3,measure),['One simple','routine']);
  assert.deepEqual(wrapLines('A simple routine',30,2,measure),['A simple routine']);
  assert.deepEqual(wrapLines('',30,2,measure),[]);
});
test('long share content and unbroken names stay within width and show truncation',()=>{
  for(const value of ['A very long routine with too many separate steps to show', 'a'.repeat(300), '🌱'.repeat(50)]) {
    const lines=wrapLines(value,15,2,measure);
    assert.equal(lines.length,2);assert.ok(lines.every(line=>measure(line)<=15));assert.ok(lines.at(-1).endsWith('…'));
  }
  assert.deepEqual(wrapLines('Cannot fit',0,2,measure),[]);
  assert.deepEqual(wrapLines('Cannot fit',20,0,measure),[]);
});
const code = ts.transpileModule(
  await fs.readFile(new URL("./types.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { ApiError, canUseQuizFallback, api } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
test("browser requests work without newer AbortSignal helpers", async () => {
  const previous = globalThis.fetch;
  const any = AbortSignal.any,
    timeout = AbortSignal.timeout;
  try {
    AbortSignal.any = undefined;
    AbortSignal.timeout = undefined;
    globalThis.fetch = async (url, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      return new Response('{"ok":true}');
    };
    assert.deepEqual(await api("/api/test"), { ok: true });
  } finally {
    globalThis.fetch = previous;
    AbortSignal.any = any;
    AbortSignal.timeout = timeout;
  }
});
test("session, consent, validation and stale-result errors cannot become offline routines", () => {
  for (const status of [400, 401, 403, 404, 409, 413, 415, 422, 429])
    assert.equal(canUseQuizFallback(new ApiError("Rejected", status)), false);
});
test("only network, service and timeout failures allow an honest offline quiz routine", () => {
  assert.equal(canUseQuizFallback(new TypeError("Failed to fetch")), true);
  assert.equal(canUseQuizFallback(new ApiError("Unavailable", 503)), true);
  assert.equal(
    canUseQuizFallback(new DOMException("Timeout", "TimeoutError")),
    true,
  );
  assert.equal(
    canUseQuizFallback(new DOMException("Cancelled", "AbortError")),
    false,
  );
  assert.equal(canUseQuizFallback(new Error("Programming error")), false);
});

test('cancelling native label sharing does not trigger an unexpected download',async()=>{
  let shareCode=ts.transpileModule(await fs.readFile(new URL('./share.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  const layoutCode=ts.transpileModule(await fs.readFile(new URL('./text-layout.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  shareCode=shareCode.replace("'./text-layout'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(layoutCode).toString('base64')));
  const {shareLabel}=await import('data:text/javascript;base64,'+Buffer.from(shareCode).toString('base64'));
  const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const oldDocument=globalThis.document;let downloadAttempted=false;
  const context={fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},measureText(value){return {width:value.length*12};}};
  globalThis.document={fonts:{ready:Promise.resolve()},createElement(kind){if(kind==='canvas')return {getContext:()=>context,toBlob:callback=>callback(new Blob(['synthetic image'],{type:'image/png'}))};downloadAttempted=true;throw new Error('Unexpected download');}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{canShare:()=>true,share:async()=>{throw new DOMException('Cancelled','AbortError');}}});
  try {
    const result=await shareLabel({id:'fixture',createdAt:'2026-10-25T00:00:00Z',analysis:null},{stopped:false,focusAreas:[],am:[],pm:[]});
    assert.equal(result,'cancelled');assert.equal(downloadAttempted,false);
  }finally{globalThis.document=oldDocument;if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);else delete globalThis.navigator;}
});
