import assert from "node:assert/strict";
import { test } from "node:test";
import { compile } from "mdsvex";

test("callouts preserve Markdown in their body", async () => {
  const { code } = await compile(`<aside class="callout">

<h2>About this story</h2>

A short note with a [source](https://example.org) and *emphasis*.

</aside>`);

  assert.match(code, /<aside class="callout">/);
  assert.match(code, /<h2>About this story<\/h2>/);
  assert.match(code, /<a href="https:\/\/example.org"[^>]*>source<\/a>/);
  assert.match(code, /<em>emphasis<\/em>/);
});
