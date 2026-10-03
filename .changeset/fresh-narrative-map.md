---
"@allmaps/slides": minor
---

Add `slides init [directory]` (also available as `slides create`) to create a minimal English project with configuration, an example slide, package scripts and setup instructions. Interactive runs ask for a title and an optional Protomaps key, both editable later. Skipping the key writes an empty `protomaps.key` and uses no basemap. Use `--title`, `--protomaps-key` and `--yes` for automation; non-interactive runs do not prompt. The starter pins the running Slides version and refuses to overwrite existing files. Cancelling setup leaves no partial project.
