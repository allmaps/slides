import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSlidesConfig } from "../src/model/content-schema.ts";
import { buildProject, getChapterCount, getChapterNumber, getChapterLabel, getSubslideshowNumber, getSlideshowNumber } from "../src/model/project.ts";

function fixture(multiple = false) {
  const parsed = parseSlidesConfig({
    title: "Story", main: "main",
    slideshows: [
      { id: "main", path: "main" },
      { id: "first", path: "first" },
      { id: "second", path: "second" },
    ],
  }, "fixture");
  assert.equal(parsed.success, true);
  const slides = {
    "main/00-intro.md": { metadata: { title: "Welcome" } },
    "main/01-chapter.md": { metadata: { title: "Chapter", subslideshows: multiple ? ["first", { id: "second" }] : ["first"] } },
    "main/02-last.md": { metadata: { title: "Last" } },
    "first/00-intro.md": { metadata: { title: "Section introduction" } },
    "first/01-one.md": { metadata: { title: "One" } },
    "first/02-two.md": { metadata: { title: "Two" } },
    "second/01-one.md": { metadata: { title: "One" } },
    "second/02-two.md": { metadata: { title: "Two" } },
  };
  return { config: parsed.data, slides, project: buildProject(parsed.data, slides) };
}

test("all slides are included in chapter numbering and totals", () => {
  const { project } = fixture();
  const [main, first] = project.slideshows;
  assert.equal(main.chapters.length, 3);
  assert.equal(getChapterCount(main), 3);
  assert.equal(getChapterNumber(main, "intro"), 1);
  assert.equal(getChapterLabel(project, main, "intro"), "1");
  assert.equal(getChapterLabel(project, main, "chapter"), "2");
  assert.equal(getChapterLabel(project, main, "last"), "3");
  assert.equal(getChapterCount(first), 3);
  assert.equal(getSlideshowNumber(project, first), "2");
  assert.equal(getChapterLabel(project, first, "intro"), "2.1");
  assert.equal(getChapterLabel(project, first, "one"), "2.2");
  assert.equal(getChapterLabel(project, first, "two"), "2.3");
});

test("multiple subslideshows add their own numbered level", () => {
  const { project } = fixture(true);
  const [main, first, second] = project.slideshows;
  assert.equal(getSubslideshowNumber(main, main.chapters[1], "first"), "2.1");
  assert.equal(getSubslideshowNumber(main, main.chapters[1], "second"), "2.2");
  assert.equal(getSlideshowNumber(project, first), "2.1");
  assert.equal(getChapterLabel(project, first, "intro"), "2.1.1");
  assert.equal(getChapterLabel(project, first, "one"), "2.1.2");
  assert.equal(getChapterLabel(project, first, "two"), "2.1.3");
  assert.equal(getChapterLabel(project, second, "one"), "2.2.1");
  assert.equal(getChapterLabel(project, second, "two"), "2.2.2");
});

test("empty slideshows and unknown slugs do not invent chapter numbers", () => {
  const { config } = fixture();
  const project = buildProject(config, {});
  const main = project.slideshows[0];
  assert.equal(getChapterCount(main), 0);
  assert.equal(getChapterNumber(main, "missing"), undefined);
  assert.equal(getChapterLabel(project, main, "missing"), undefined);
});
