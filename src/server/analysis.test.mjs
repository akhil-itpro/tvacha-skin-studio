import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
const modules = {};
for (const [name, file] of [
  ["types", "../domain/types.ts"],
  ["safety", "../domain/safety.ts"],
  ["analysis", "./analysis-client.ts"],
]) {
  const source = await fs.readFile(new URL(file, import.meta.url), "utf8");
  let code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  code = code.replace(
    /from ['"](?:\.\/|\.\.\/domain\/)([^'"]+)['"]/g,
    (_, dependency) => `from '${modules[dependency]}'`,
  );
  modules[name] =
    "data:text/javascript;base64," + Buffer.from(code).toString("base64");
}
const { analysisConfiguration, requestPhotoAnalysis } = await import(
  modules.analysis
);
const keys = [
  "shine",
  "breakouts",
  "dark_spots",
  "redness",
  "dryness",
  "under_eye",
];
const valid = () => ({
  image_ok: true,
  retake_reasons: [],
  concerns: keys.map((key) => ({
    key,
    level: 1,
    confidence: "medium",
    zones: ["cheeks"],
    note: "Visible in this photo.",
  })),
});
const config = {
  PHOTO_AI_PROVIDER: "groq",
  GROQ_API_KEY: "fixture-not-a-real-key",
  GROQ_ZDR_ENABLED: "true",
};
const response = (body) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(body) } }],
    }),
    { headers: { "content-type": "application/json" } },
  );

test("photo providers remain disabled until key and data protection settings are explicit", () => {
  assert.equal(analysisConfiguration({}).ready, false);
  assert.equal(
    analysisConfiguration({ ...config, GROQ_ZDR_ENABLED: "false" }).ready,
    false,
  );
  assert.equal(analysisConfiguration(config).ready, true);
  assert.equal(
    analysisConfiguration({
      PHOTO_AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "fixture",
    }).ready,
    false,
  );
  assert.equal(
    analysisConfiguration({
      PHOTO_AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "fixture",
      GEMINI_DATA_POLICY: "paid",
    }).ready,
    true,
  );
});
test("missing protection settings never make a network call", async () => {
  let calls = 0;
  const result = await requestPhotoAnalysis(
    "fixture",
    { ...config, GROQ_ZDR_ENABLED: "" },
    async () => {
      calls++;
      throw Error();
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.analysis, null);
});
test("Groq receives one in-memory image and strict cosmetic-only output requirements", async () => {
  const result = await requestPhotoAnalysis(
    "test-image",
    config,
    async (url, options) => {
      assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
      const body = JSON.parse(options.body);
      assert.equal(body.model, "qwen/qwen3.8-27b");
      assert.equal(body.response_format.type, "json_object");
      assert.equal(body.reasoning_effort, "none");
      assert.equal(
        body.messages[1].content[1].image_url.url,
        "data:image/jpeg;base64,test-image",
      );
      assert.ok(body.messages[0].content.includes("Never estimate age"));
      return response(valid());
    },
  );
  assert.deepEqual(result.analysis, valid());
});
test("invalid or prohibited model output retries once, then never invents scores", async () => {
  let calls = 0;
  const unsafe = valid();
  unsafe.concerns[0].note = "This is eczema.";
  let result = await requestPhotoAnalysis("test", config, async () => {
    calls++;
    return response(unsafe);
  });
  assert.equal(calls, 2);
  assert.equal(result.analysis, null);
  calls = 0;
  result = await requestPhotoAnalysis("test", config, async () => {
    calls++;
    return response(calls === 1 ? unsafe : valid());
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.analysis, valid());
});
test("rate limits and invalid keys stop immediately without switching providers", async () => {
  for (const status of [400, 401, 402, 403, 404, 429]) {
    let calls = 0;
    const result = await requestPhotoAnalysis(
      "test",
      { ...config, GEMINI_API_KEY: "different-provider" },
      async (url) => {
        assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
        calls++;
        return new Response("{}", { status });
      },
    );
    assert.equal(calls, 1);
    assert.equal(result.analysis, null);
  }
});
test("Gemini excludes thought blocks from final JSON and uses low thinking effort", async () => {
  const result = await requestPhotoAnalysis(
    "test",
    {
      PHOTO_AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "fixture",
      GEMINI_DATA_POLICY: "paid",
    },
    async (url, options) => {
      assert.match(url, /^https:\/\/generativelanguage.googleapis.com\//);
      const body = JSON.parse(options.body);
      assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "low");
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    thought: true,
                    text: "Private provider reasoning is not result data.",
                  },
                  { text: JSON.stringify(valid()) },
                ],
              },
            },
          ],
        }),
      );
    },
  );
  assert.deepEqual(result.analysis, valid());
});
test("provider response sizes are bounded before JSON decoding", async () => {
  let calls = 0;
  const result = await requestPhotoAnalysis("test", config, async () => {
    calls++;
    return new Response("x".repeat(81_000));
  });
  assert.equal(calls, 2);
  assert.equal(result.analysis, null);
});
test("unusable photos produce a real retake response", async () => {
  const retake = valid();
  retake.image_ok = false;
  retake.retake_reasons = ["Face a window and try again."];
  for (const concern of retake.concerns) {
    concern.level = 0;
    concern.confidence = "low";
  }
  const result = await requestPhotoAnalysis("test", config, async () =>
    response(retake),
  );
  assert.equal(result.analysis.image_ok, false);
  assert.match(result.message, /clearer photo/);
});
