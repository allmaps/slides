import assert from "node:assert/strict";
import { test } from "node:test";
import { compile } from "mdsvex";
import remarkFootnotes from "remark-footnotes";
import removeFootnoteLinks from "../src/lib/shared/remove-footnote-links.js";
import rehypeImages from "../src/lib/shared/rehype-images.js";

const compileMarkdown = async (markdown) => {
  const { code } = await compile(markdown, {
    remarkPlugins: [remarkFootnotes],
    rehypePlugins: [removeFootnoteLinks, rehypeImages],
  });
  return code;
};

test("ordinary lists and links inside footnotes are preserved", async () => {
  const html = await compileMarkdown(
    "1. An ordinary list item\n\nText[^2].\n\n[^2]: A [source](https://example.org) with *emphasis*.\n\n    1. A nested list item",
  );
  assert.match(html, /<li>An ordinary list item<\/li>/);
  assert.match(html, /<li>A nested list item<\/li>/);
  assert.match(html, /<a href="https:\/\/example.org"[^>]*>source<\/a>/);
  assert.match(html, /<em>emphasis<\/em>/);
});

test("definitions following IIIF figures render as footnotes", async () => {
  const html = await compileMarkdown(
    'Text[^1].\n\n<figure data-manifest="https://example.org/manifest.json">\n\n<figcaption>\n\nA caption.\n\n</figcaption>\n</figure>\n\n[^1]: The source.',
  );
  assert.match(html, /<div class="footnotes">/);
  assert.match(html, /<li id="fn-1">The source\.<\/li>/);
  assert.ok(html.indexOf('</figure>') < html.indexOf('<div class="footnotes">'));
});
