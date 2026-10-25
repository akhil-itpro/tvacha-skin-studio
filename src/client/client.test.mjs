import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
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
