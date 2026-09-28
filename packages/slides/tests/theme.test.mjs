import assert from "node:assert/strict";
import { test } from "node:test";
import { slidesConfigSchema, parseSlidesConfig } from "../src/model/content-schema.ts";
import { buildProject } from "../src/model/project.ts";
import { resolveTheme } from "../src/model/theme.ts";

test("Allmaps themes resolve to the supplied foreground/background pairs", () => {
  const palettes = {
    green: ["#64c18f", "#c1e6d2"],
    purple: ["#c552b5", "#e8bae1"],
    red: ["#fe5e60", "#ffbfbf"],
    yellow: ["#ffc742", "#ffe9b3"],
    orange: ["#ff7415", "#ffc7a1"],
    pink: ["#ff56ba", "#ffbbe3"],
    blue: ["#63d8e6", "#c1eff5"],
  };
  assert.deepEqual(resolveTheme(), resolveTheme("green"));
  for (const [name, [fg, bg]] of Object.entries(palettes)) {
    const config = parseSlidesConfig({ theme: name }, "fixture");
    assert.equal(config.success, true);
    const project = buildProject(config.data, {});
    assert.deepEqual(resolveTheme(project.theme), { fg, bg });
    assert.deepEqual(resolveTheme(project.theme, "dark"), { fg, bg });
  }
});

test("custom theme colors survive parsing and project serialization independently of map theme", () => {
  const config = parseSlidesConfig({ theme: { fg: " #123 ", bg: "#e8BaE1" }, map: { theme: "dark" } }, "fixture");
  assert.equal(config.success, true);
  const project = JSON.parse(JSON.stringify(buildProject(config.data, {})));
  assert.deepEqual(resolveTheme(project.theme), { fg: "#123", bg: "#e8BaE1" });
  assert.deepEqual(resolveTheme(project.theme, "dark"), { fg: "#123", bg: "#e8BaE1" });
  assert.equal(config.data.map.theme, "dark");
  assert.deepEqual(resolveTheme(buildProject(parseSlidesConfig({}, "fixture").data, {}).theme), resolveTheme("green"));
});

test("per-mode colors survive project serialization and follow the interface mode independently of the map", () => {
  const config = parseSlidesConfig({ theme: {
    light: { fg: " #123 ", bg: "#fff" }, dark: { fg: " #abc ", bg: "#456" },
  }, map: { theme: "light" } }, "fixture");
  assert.equal(config.success, true);
  const project = JSON.parse(JSON.stringify(buildProject(config.data, {})));
  assert.deepEqual(resolveTheme(project.theme, "light"), { fg: "#123", bg: "#fff" });
  assert.deepEqual(resolveTheme(project.theme, "dark"), { fg: "#abc", bg: "#456" });
  assert.deepEqual(resolveTheme(project.theme, "light"), { fg: "#123", bg: "#fff" });
  assert.equal(config.data.map.theme, "light");
});

test("per-mode palettes accept names and fall back to light or the default green", () => {
  for (const [theme, light, dark] of [
    [{ light: "purple", dark: "blue" }, "purple", "blue"],
    [{ light: "purple" }, "purple", "purple"],
    [{ dark: "blue" }, "green", "blue"],
    [{ light: "purple", dark: { fg: "#fff", bg: "#333" } }, "purple", { fg: "#fff", bg: "#333" }],
  ]) {
    const config = parseSlidesConfig({ theme }, "fixture");
    assert.equal(config.success, true);
    const project = buildProject(config.data, {});
    assert.deepEqual(resolveTheme(project.theme, "light"), resolveTheme(light));
    assert.deepEqual(resolveTheme(project.theme, "dark"), resolveTheme(dark));
  }
});

test("invalid or incomplete themes are rejected instead of silently using a different palette", () => {
  for (const theme of ["unknown", {}, { fg: "#123" }, { bg: "#fff" },
    { fg: "red", bg: "#fff" }, { fg: "#12345", bg: "#fff" },
    { fg: "#1234", bg: "#fff" }, { fg: "#12345678", bg: "#fff" },
    { fg: "#fff; color: red", bg: "#fff" }, { fg: "#ggg", bg: "#fff" },
    { fg: "#123", bg: "#fff", icon: "#000" },
    { light: "unknown" }, { dark: { fg: "#abc" } }, { dark: { fg: "#abc", bg: "red" } },
    { light: "purple", dark: { fg: "#abc", bg: "#0008" } },
    { light: "purple", dark: { fg: "#abc", bg: "#123", icon: "#000" } },
    { light: "purple", other: "blue" }, { fg: "#123", bg: "#fff", dark: "blue" },
  ]) {
    assert.equal(slidesConfigSchema.safeParse({ theme }).success, false, JSON.stringify(theme));
  }
});
