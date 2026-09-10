import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { compile } from "mdsvex";
import { compile as compileSvelte } from "svelte/compiler";
import { render } from "svelte/server";
import rehypeImages from "../src/lib/shared/rehype-images.js";

const compileMarkdown = async (markdown) => {
  const { code } = await compile(markdown, {
    layout: "./src/lib/components/Section.svelte",
    rehypePlugins: [rehypeImages],
  });
  compileSvelte(code, { generate: "server" });
  return code;
};

// Render the actual Image component with a known local derivative in its asset
// registry. SSR must not emit an img/srcset that fetches before Atlas mounts.
let renderImage;
let fixtureDirectory;
before(async () => {
  fixtureDirectory = await mkdtemp(new URL('./.image-render-', import.meta.url));
  const source = await readFile(new URL('../src/lib/components/Image.svelte', import.meta.url), 'utf8');
  const { js } = compileSvelte(source.replace('"$lib/shared/paths"', '"./paths.mjs"'), { generate: 'server' });
  await writeFile(`${fixtureDirectory}/Image.mjs`, js.code);
  await writeFile(`${fixtureDirectory}/paths.mjs`, `
    export const getContentIiifImage = path => path === 'assets/images/photo.jpg'
      ? { servicePath: 'photo', width: 1200, height: 800 } : undefined;
    export const getContentAssetUrl = () => undefined;
    export const isExternalUrl = url => /^https?:/.test(url);
    export const joinUrl = (...parts) => parts.join('/');
    export const withBaseUrl = path => '/demo/' + path;
  `);
  const { default: Image } = await import(pathToFileURL(`${fixtureDirectory}/Image.mjs`).href);
  renderImage = props => render(Image, { props }).body;
});
after(async () => { if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true }); });

test('local Markdown images emit only an IIIF marker, with no fallback request', () => {
  const html = renderImage({ src: 'assets/images/photo.jpg#xywh=10,20,300,200', alt: 'Shipyard' });
  assert.match(html, /data-iiif-image="\/demo\/iiif\/photo#xywh=10,20,300,200"/);
  assert.match(html, /data-alt="Shipyard"/);
  assert.doesNotMatch(html, /<img|<picture|<source|srcset=/);
});

test('external image URLs never opt into IIIF without explicit figure attributes', () => {
  for (const src of ['https://example.org/photo.jpg', 'https://example.org/iiif/photo/info.json', 'https://example.org/iiif/photo/full/1024,/0/default.jpg']) {
    const html = renderImage({ src, alt: 'Shipyard' });
    assert.match(html, /<img /);
    assert.ok(html.includes(`src="${src}"`));
    assert.doesNotMatch(html, /data-iiif-image|srcset=/);
  }
});

test('inline local derivatives remain visible ordinary images', () => {
  const html = renderImage({ src: 'assets/images/photo.jpg', alt: 'Icon', 'data-inline': true });
  assert.match(html, /<img src="\/demo\/iiif\/photo\/full\/max\/0\/default.jpg"/);
  assert.doesNotMatch(html, /data-iiif-image|srcset=/);
});

test("manifest figures need no image or component imports and retain rich captions", async () => {
  const code = await compileMarkdown(`<figure data-manifest="https://example.org/manifest.json" data-canvas="https://example.org/canvas/2" aria-label="Shipyard">\n\n<figcaption>\n\nA *drawing*. [Institution](https://example.org/object).\n\n</figcaption>\n</figure>`);
  assert.equal((code.match(/<figure\b/g) ?? []).length, 1);
  assert.match(code, /data-manifest="https:\/\/example.org\/manifest.json"/);
  assert.match(code, /data-canvas="https:\/\/example.org\/canvas\/2"/);
  assert.match(code, /<em>drawing<\/em>/);
  assert.match(code, /<Components.a href="https:\/\/example.org\/object"/);
  assert.doesNotMatch(code, /Components.img|CanvasPanel/);
});

test("image figures support local sources without a second image", async () => {
  const code = await compileMarkdown(`<figure data-image="assets/images/photo.jpg" aria-label="Description">\n\n<figcaption>\n\n[Institution](https://example.org)\n\n</figcaption>\n</figure>`);
  assert.equal((code.match(/<figure\b/g) ?? []).length, 1);
  assert.match(code, /aria-label="Description"/);
  assert.doesNotMatch(code, /Components.img/);
  const withoutImage = await compileMarkdown('<figure data-image="https://example.org/iiif/photo/info.json">\n\n<figcaption>Caption</figcaption>\n</figure>');
  assert.doesNotMatch(withoutImage, /Components.img/);
});

test("ordinary Markdown images retain captions; inline images stay inline", async () => {
  const code = await compileMarkdown("![Old caption](photo.jpg)\n\n![](empty.jpg)\n\nText ![icon](icon.png) text.");
  assert.equal((code.match(/<figure>/g) ?? []).length, 2);
  assert.equal((code.match(/<figcaption>/g) ?? []).length, 1);
  assert.match(code, /<figcaption>Old caption<\/figcaption>/);
  assert.match(code, /<p>Text <Components.img/);
  assert.match(code, /data-inline/);
  assert.doesNotMatch(code, /<p><figure>/);
  const linked = await compileMarkdown('Text [![icon](assets/images/photo.jpg)](https://example.org) text.');
  assert.match(linked, /data-inline/);
  assert.doesNotMatch(linked, /<figure>/);
});

test("explicit figure state ends at its closing tag and ignores comments", async () => {
  const code = await compileMarkdown('<figure data-image="https://example.org/image">\n\n<figcaption>Caption</figcaption>\n</figure>\n\n<!-- <figure> -->\n\n![Legacy](second.jpg)');
  assert.match(code, /<figcaption>Legacy<\/figcaption>/);
});

test("Markdown compilation never fetches remote IIIF resources", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Unexpected network request"); };
  try {
    await compileMarkdown('<figure data-manifest="https://offline.invalid/manifest.json">\n\n<figcaption>Offline source</figcaption>\n</figure>\n\n![Legacy](https://offline.invalid/iiif/info.json)');
  } finally { globalThis.fetch = previous; }
});

