import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const entry: Record<string, string> = {
  "cli/main": "src/cli/main.js",
  renderer: "src/renderer.js",
};
for (const [name, source] of Object.entries(pkg.exports)) {
  // Components retain their .svelte files and are built with svelte-package.
  if (name === "./package.json" || name === "./canvas-panel") continue;
  const output = pkg.publishConfig.exports[name].default;
  entry[output.replace(/^\.\/dist\//, "").replace(/\.js$/, "")] = source as string;
}

export default defineConfig({
  entry,
  format: "esm",
  platform: "node",
  target: "node24",
  outDir: "dist",
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  dts: { eager: true },
  deps: {
    neverBundle: true,
    alwaysBundle: [/^@allmaps\/(?:iiif|static-render)(?:\/|$)/],
    // Check declarations too: an unpublished workspace import must not escape.
    onlyImport: [pkg.name, ...Object.keys(pkg.dependencies)],
  },
});
