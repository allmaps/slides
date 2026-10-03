import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stringify } from "yaml";
import { CommandInterruptedError } from "../../build/process.ts";
import { packageRoot } from "../../package.ts";

type InitOptions = { title?: string; protomapsKey?: string; yes?: boolean };

async function projectSettings(options: InitOptions) {
  const defaultTitle = "My narrative map";
  let title = options.title?.trim();
  let key = options.protomapsKey?.trim();
  if (title === "") throw new Error("The project title must not be empty.");

  if (!options.yes && process.stdin.isTTY && process.stdout.isTTY &&
      (title === undefined || key === undefined)) {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    const cancellation = new AbortController();
    const cancel = () => cancellation.abort();
    readline.on("SIGINT", cancel);
    readline.on("close", cancel);
    try {
      console.log("You can change the title and Protomaps key later in slides.config.yml.\n");
      if (title === undefined) {
        title = (await readline.question(`Project title [${defaultTitle}]: `, { signal: cancellation.signal })).trim() || defaultTitle;
      }
      if (key === undefined) {
        console.log("\nGet an optional key at https://protomaps.com/api. It will be included in your public website.");
        key = (await readline.question("Protomaps API key (optional; Enter for no basemap): ", { signal: cancellation.signal })).trim();
      }
    } catch (error) {
      if (cancellation.signal.aborted) {
        console.log("\nProject creation cancelled. No files were written.");
        throw new CommandInterruptedError("SIGINT");
      }
      throw error;
    } finally {
      readline.off("SIGINT", cancel);
      readline.off("close", cancel);
      readline.close();
    }
  }
  return { title: title ?? defaultTitle, key: key ?? "" };
}

async function entryExists(filename: string) {
  try { return await lstat(filename); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function runInitCommand(directory = ".", options: InitOptions = {}) {
  const root = path.resolve(directory);
  const existing = await entryExists(root);
  if (existing && !existing.isDirectory()) throw new Error(`Project path must be a directory: ${root}`);

  // Reserve the whole chapter directory and every supported config filename so
  // an existing project cannot accidentally become part of the starter.
  const reserved = ["package.json", "pnpm-workspace.yaml", ".gitignore", "README.md", "chapters",
    "slides.config.yml", "slides.config.yaml", "slides.config.json"];
  const conflicts = [];
  for (const filename of reserved) {
    if (await entryExists(path.join(root, filename))) conflicts.push(filename);
  }
  if (conflicts.length) {
    throw new Error(`Cannot initialize ${root}: already contains ${conflicts.join(", ")}. Choose an empty folder; existing files have not been changed.`);
  }

  const { title, key } = await projectSettings(options);
  const { version } = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  const name = path.basename(root).toLowerCase().replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 214) || "slides-project";
  const files: Record<string, string> = {
    "package.json": JSON.stringify({
      name,
      private: true,
      type: "module",
      scripts: {
        dev: "slides dev .",
        build: "slides build .",
        preview: "slides preview .",
        validate: "slides validate .",
        check: "slides check .",
      },
      devDependencies: { "@allmaps/slides": version },
      packageManager: "pnpm@10.22.0",
      engines: { node: ">=24" },
    }, null, 2) + "\n",
    "pnpm-workspace.yaml": `# Keep this project's dependencies and lockfile independent of parent workspaces.
packages: []

onlyBuiltDependencies:
  - '@maplibre/maplibre-gl-native'
  - esbuild
  - sharp
`,
    ".gitignore": `node_modules/
.pnpm-store/
.slides/
.svelte-kit/
dist/
static/iiif/
.env
.env.*
!.env.example
.DS_Store
`,
    "slides.config.yml": stringify({
      title,
      main: "main",
      slideshows: [{ id: "main", path: "chapters" }],
      protomaps: { key },
    }),
    "chapters/01-welcome.md": `---
title: Rokovoko
location:
  center: [-145, -12]
  zoom: 3
---

> Queequeg was a native of Rokovoko, an island far away to the West and South. It is not down on any map; true places never are.

— Herman Melville, *Moby-Dick*, [Chapter 12](https://www.gutenberg.org/files/2701/2701-h/2701-h.htm#link2HCH0012)

Edit this slide and add more Markdown files in the chapters folder.
`,
    "README.md": `# My Allmaps Slides project

Create a narrative map with [Allmaps Slides](https://github.com/allmaps/slides).

## Preview

Use Node.js 24 or later and pnpm 10:

\`\`\`sh
pnpm install
pnpm dev
\`\`\`

Open the URL printed in the terminal. Edit \`chapters/01-welcome.md\` and add more
Markdown files in \`chapters/\`.
Commit your lockfile to keep builds reproducible.

Change the title and optional \`protomaps.key\` in \`slides.config.yml\` at any time.
With no key, the example uses a plain background. Get your own key at
[protomaps.com/api](https://protomaps.com/api) to add a basemap; it is included
in the public website. To add maps and images,
see [authoring](https://github.com/allmaps/slides/blob/main/docs/authoring.md) and
[basemap setup](https://github.com/allmaps/slides/blob/main/docs/configuration.md#basemaps).

## Build and publish

\`\`\`sh
pnpm validate
pnpm build
pnpm preview
\`\`\`

The static website is written to \`dist/\`. See
[deployment](https://github.com/allmaps/slides/blob/main/docs/deployment.md) for
public URLs, hosting and Linux rendering dependencies.

Choose a license for your own content before sharing it. The Slides software
has [separate licensing terms](https://github.com/allmaps/slides/blob/main/docs/licensing.md).
`,
  };

  await mkdir(root, { recursive: true });
  await mkdir(path.join(root, "chapters"));
  for (const [filename, contents] of Object.entries(files)) {
    // Exclusive writes also protect files created after the preflight check.
    await writeFile(path.join(root, filename), contents, { flag: "wx" });
  }
  console.log(`Created an Allmaps Slides project in ${root}.`);
  console.log("\nNext steps:");
  if (root !== process.cwd()) console.log(`  Open ${root} in your terminal.`);
  console.log("  pnpm install\n  pnpm dev");
  console.log("\nEdit chapters/01-welcome.md to begin.");
  console.log("You can change the title and Protomaps key later in slides.config.yml.");
}
