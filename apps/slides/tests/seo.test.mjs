import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { compile } from "svelte/compiler";
import { render } from "svelte/server";
import { absolutePublicUrl, createSlideshowSeo } from "../src/lib/shared/seo.ts";

const main = {
  id: "main", slug: "", title: "Atlas", sources: {},
  chapters: [
    { slug: "intro", title: "Introduction", subslideshows: ["history"] },
    { slug: "now", title: "Today", subslideshows: ["history", "other"] },
  ],
};
const history = {
  id: "history", slug: "history", title: "History", sources: {},
  description: " Slideshow summary ",
  chapters: [
    { slug: "beginning", title: "The beginning", description: "First slide summary" },
    { slug: "zeil & stoom", title: "Sail & steam" },
  ],
};
const other = { ...history, id: "other", slug: "other", title: "Other slideshow" };
const project = { title: "Atlas", description: "Project summary", main: "main", slideshows: [main, history, other] };

let directory, Seo, Toc, env, deployment;
before(async () => {
  directory = await mkdtemp(new URL("./.seo-render-", import.meta.url));
  await writeFile(`${directory}/environment.mjs`, `
    export const env = { PUBLIC_URL: 'https://example.org/atlas/' };
    export const deployment = { base: '/atlas' };
    export const withBaseUrl = path => deployment.base + '/' + path;
    export const getSlideshowRouteHref = slideshow => withBaseUrl(slideshow.slug);
    export const getChapterAnchorHref = (slideshow, chapter) =>
      getSlideshowRouteHref(slideshow) + '#' + encodeURIComponent(chapter.slug);
  `);
  ({ env, deployment } = await import(pathToFileURL(`${directory}/environment.mjs`).href));
  const icon = compile('<svg aria-hidden="true"></svg>', { generate: "server" }).js.code;
  await writeFile(`${directory}/Icon.mjs`, icon);
  await writeFile(`${directory}/icons.mjs`, `export { default as X, default as ChevronDown, default as ChevronRight, default as ListChevronsDownUp, default as ListChevronsUpDown } from './Icon.mjs';`);
  for (const component of ["SlideshowSeo", "PanelOverlay", "SlideshowToc"]) {
    const source = await readFile(new URL(`../src/lib/components/${component}.svelte`, import.meta.url), "utf8");
    const { js } = compile(source
      .replaceAll('"$env/dynamic/public"', '"./environment.mjs"')
      .replaceAll('"$lib/shared/interface-context"', JSON.stringify(new URL("../src/lib/shared/interface-context.ts", import.meta.url).href))
      .replaceAll('"$lib/shared/paths"', '"./environment.mjs"')
      .replaceAll('"$lib/shared/project"', '"./environment.mjs"')
      .replaceAll('"$lib/shared/seo"', JSON.stringify(new URL("../src/lib/shared/seo.ts", import.meta.url).href))
      .replaceAll('"$lib/components/PanelOverlay.svelte"', '"./PanelOverlay.mjs"')
      .replaceAll('"@lucide/svelte"', '"./icons.mjs"'), { generate: "server" });
    await writeFile(`${directory}/${component}.mjs`, js.code);
  }
  ({ default: Seo } = await import(pathToFileURL(`${directory}/SlideshowSeo.mjs`).href));
  ({ default: Toc } = await import(pathToFileURL(`${directory}/SlideshowToc.mjs`).href));
});
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

const jsonLdFrom = (head) => {
  const scripts = [...head.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  assert.equal(scripts.length, 1);
  return JSON.parse(scripts[0][1]);
};

test("SSR metadata uses each deployment's domain and base path without doubling it", () => {
  for (const [publicUrl, base] of [
    ["https://amsterdamtimemachine.github.io/kattenburg-atlas/", "/kattenburg-atlas"],
    // Local development can run at / while describing the deployed subpath.
    ["https://amsterdamtimemachine.github.io/kattenburg-atlas/", ""],
    ["https://kattenburg.amsterdamtimemachine.nl/", ""],
    ["http://localhost:5173/", ""],
  ]) {
    env.PUBLIC_URL = publicUrl;
    deployment.base = base;
    const { head } = render(Seo, { props: {
      project, slideshow: history, image: { path: "thumbnails/history.jpg", width: 1200, height: 630 },
    } });
    const data = jsonLdFrom(head);
    assert.equal(data.url, `${publicUrl}history`);
    assert.ok(head.includes(`<link rel="canonical" href="${data.url}"`));
    assert.equal(data.primaryImageOfPage.url, `${publicUrl}thumbnails/history.jpg`);
    assert.equal(data.description, "Slideshow summary");
    assert.equal(data.isPartOf.url, publicUrl);
    assert.deepEqual(data.breadcrumb.itemListElement.map(item => item.item), [publicUrl, data.url]);
    assert.deepEqual(data.mainEntity.hasPart.map(item => [item.position, item.name, item.url]), [
      [1, "The beginning", `${publicUrl}history#beginning`],
      [2, "Sail & steam", `${publicUrl}history#zeil%20%26%20stoom`],
    ]);
    assert.ok(data.mainEntity.hasPart.every(part => !Object.hasOwn(part, "isPartOf")));
    assert.equal(data.mainEntity.hasPart[1].description, undefined);
  }
});

test("each route emits only its slideshow, including the main slideshow", () => {
  env.PUBLIC_URL = "https://example.org/";
  deployment.base = "";
  for (const slideshow of project.slideshows) {
    const data = jsonLdFrom(render(Seo, { props: { project, slideshow } }).head);
    assert.equal(data.name, slideshow.title);
    assert.deepEqual(data.mainEntity.hasPart.map(part => part.name), slideshow.chapters.map(chapter => chapter.title));
    assert.equal(data.breadcrumb === undefined, slideshow.id === project.main);
  }
});

test("missing thumbnails and invalid public URLs do not invent image URLs or canonical hosts", () => {
  for (const publicUrl of [undefined, "", "/atlas/", "not a url", "javascript:alert(1)"]) {
    env.PUBLIC_URL = publicUrl;
    const { head } = render(Seo, { props: { project, slideshow: history } });
    assert.doesNotMatch(head, /application\/ld\+json|rel="canonical"|og:image/);
    assert.match(head, /Slideshow summary/);
  }
});

test("social titles include the main slideshow title without duplicating it", () => {
  const renamedProject = { ...project, title: "Different project label" };
  for (const [slideshow, title] of [[main, "Atlas"], [history, "Atlas — History"], [{ ...history, title: "Atlas" }, "Atlas"]]) {
    const { head } = render(Seo, { props: { project: renamedProject, slideshow } });
    assert.ok(head.includes(`<meta property="og:title" content="${title}"`));
    assert.ok(head.includes(`<meta name="twitter:title" content="${title}"`));
    assert.equal(createSlideshowSeo({ project: renamedProject, slideshow }).title, title);
  }
});

test("public URLs retain nested subpaths with or without a trailing slash", () => {
  for (const publicUrl of ["https://example.org/stories/atlas", "https://example.org/stories/atlas/"]) {
    assert.equal(absolutePublicUrl("history", publicUrl), "https://example.org/stories/atlas/history");
    assert.equal(absolutePublicUrl("/history", publicUrl), "https://example.org/stories/atlas/history");
    assert.equal(absolutePublicUrl("", publicUrl), "https://example.org/stories/atlas/");
    assert.equal(absolutePublicUrl("thumbnails/social.jpg", publicUrl), "https://example.org/stories/atlas/thumbnails/social.jpg");
  }
});

test("slideshow descriptions fall back to first chapter, then project", () => {
  const options = { project, publicUrl: "https://example.org" };
  assert.equal(createSlideshowSeo({ ...options, slideshow: { ...history, description: undefined } }).description, "First slide summary");
  assert.equal(createSlideshowSeo({ ...options, slideshow: main }).description, "Project summary");
});

test("JSON-LD escapes script terminators without changing authored titles", () => {
  env.PUBLIC_URL = "https://example.org/";
  const title = '</script><script>alert("title & data")</script>';
  const slideshow = { ...history, title, chapters: [{ slug: "unsafe", title }] };
  const { head } = render(Seo, { props: { project, slideshow } });
  const data = jsonLdFrom(head);
  assert.equal(data.name, title);
  assert.equal(data.mainEntity.hasPart[0].name, title);
  assert.equal((head.match(/<script\b/g) ?? []).length, 1);
  assert.ok(head.includes("\\u003c/script>"));
});

test("closed contents menu renders real chapter links, including collapsed subslideshows", () => {
  deployment.base = "/atlas";
  const { body } = render(Toc, { props: { project, slideshow: history, rootSlideshow: main, open: false } });
  assert.match(body, /<nav aria-label="Chapters">/);
  assert.match(body, /panel-overlay-shell--closed/);
  assert.match(body, /\binert\b/);
  for (const slideshow of project.slideshows) {
    for (const chapter of slideshow.chapters) {
      const href = `/atlas/${slideshow.slug}#${encodeURIComponent(chapter.slug)}`;
      assert.ok(body.includes(`href="${href}"`), `Missing SSR chapter link: ${href}`);
    }
  }
  assert.match(body, /hidden/);
});
