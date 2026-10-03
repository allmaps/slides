---
"@allmaps/slides": patch
---

Remove unused application files: the old panel toggle component, geometry helpers and content-schema re-export. Drop unused app dependencies on `@sveltejs/adapter-auto` and `@turf/turf`.

Root development commands now forward to the CLI without selecting a content repository. Pass a directory, for example `pnpm dev ./content/slides-template` or `pnpm build ../my-story`. Update the documentation and use the public Slides template for the integration workflow's application check.
