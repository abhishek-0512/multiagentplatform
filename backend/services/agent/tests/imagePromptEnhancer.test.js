
import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyScene,
  detectStyle,
  enhanceImagePrompt,
  normalizeImageSubject,
  parseAspectRatio,
  preservesIntent,
  resolveImageDimensions
} from "../utils/imagePromptEnhancer.js";

test("normalizes image requests without losing the subject", () => {
  assert.equal(
    normalizeImageSubject("Create an image of a red fox in a snowy forest"),
    "a red fox in a snowy forest"
  );

  assert.equal(
    normalizeImageSubject("Please generate a photo of an old wooden cabin"),
    "an old wooden cabin"
  );

  assert.equal(
    normalizeImageSubject("Generate a realistic image of a glass perfume bottle"),
    "a glass perfume bottle"
  );

  assert.equal(
    normalizeImageSubject("Create an anime image of a cat"),
    "a cat"
  );

  assert.equal(
    normalizeImageSubject("a red fox in a snowy forest"),
    "a red fox in a snowy forest"
  );
});

test("detects the requested art style", () => {
  assert.equal(detectStyle("Make an anime image of a cat"), "anime");
  assert.equal(
    detectStyle("Create a watercolor painting of a mountain"),
    "watercolor"
  );
  assert.equal(
    detectStyle("A photorealistic portrait of a chef"),
    "photorealistic"
  );
});

test("classifies common image scenes", () => {
  assert.equal(classifyScene("a woman wearing a blue jacket"), "portrait");
  assert.equal(classifyScene("a perfume bottle on a marble table"), "product");
  assert.equal(classifyScene("a waterfall in a forest"), "landscape");
});

test("parses aspect ratios and resolves image dimensions", () => {
  assert.equal(parseAspectRatio("desktop wallpaper 16:9"), "16:9");
  assert.equal(parseAspectRatio("vertical mobile wallpaper"), "9:16");

  const dimensions = resolveImageDimensions(
    "a mountain at sunrise",
    "landscape",
    "photorealistic",
    "16:9"
  );

  assert.equal(dimensions.aspect, "16:9");
  assert.ok(dimensions.width > dimensions.height);
  assert.equal(dimensions.width % 64, 0);
  assert.equal(dimensions.height % 64, 0);
});

test("enhances a prompt while retaining the original subject", async () => {
  const result = await enhanceImagePrompt(
    "Create an image of a red fox in a snowy forest",
    { llm: null }
  );

  assert.match(result.prompt, /red fox in a snowy forest/i);
  assert.match(result.prompt, /photograph|camera|lens|lighting/i);
  assert.equal(result.style, "photorealistic");
  assert.equal(result.method, "deterministic");
});

test("preserves non-photographic styles", async () => {
  const result = await enhanceImagePrompt(
    "Make an anime image of a cat sitting by a window",
    { llm: null }
  );

  assert.equal(result.style, "anime");
  assert.match(result.prompt, /anime/i);
  assert.match(result.prompt, /cat sitting by a window/i);
});

test("rejects unrelated prompt rewrites", () => {
  assert.equal(
    preservesIntent(
      "red fox in snowy forest",
      "A red fox standing in a snowy forest"
    ),
    true
  );

  assert.equal(
    preservesIntent(
      "red fox in snowy forest",
      "A blue sports car on a sunny road"
    ),
    false
  );
});
