<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Project } from "@allmaps/slides/model/types";
  import { resolveTheme } from "@allmaps/slides/model";
  import { createInterfaceText } from "$lib/shared/interface-settings";
  import { withBaseUrl } from "$lib/shared/paths";
  let { project, title, children }: { project: Project; title: string; children: Snippet } = $props();
  const t = createInterfaceText(() => project.interface);
  const colors = $derived(resolveTheme(project.theme));
</script>

<div class="asset-overview" style:--accent={colors.fg} style:--accent-bg={colors.bg}>
  <div class="overview-inner">
    <header>
      <a class="brand" href={withBaseUrl("")}>{project.title}</a>
      <nav aria-label={t("navigation")}>
        <a href={withBaseUrl("iiif/")}>{t("iiifOverview")}</a>
        <a href={withBaseUrl("thumbnails/")}>{t("thumbnailsOverview")}</a>
      </nav>
    </header>
    <main><h1>{title}</h1>{@render children()}</main>
  </div>
</div>

<style>
  .asset-overview { height: 100dvh; overflow-y: auto; background: #fafaf8; color: #252925; padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(40px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left)); font-family: var(--font-body); }
  .overview-inner { max-width: 1200px; margin: auto; }
  header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px; padding-bottom: 24px; border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent); }
  .brand { font: 28px/1.1 var(--font-display); text-decoration: none; }
  nav { display: flex; gap: 24px; }
  main { padding-block: 40px; }
  h1 { font: 42px/1.1 var(--font-display); margin-bottom: 20px; }
  .asset-overview :global(a) { color: inherit; text-underline-offset: 4px; text-decoration-color: var(--accent); }
  .asset-overview :global(h2) { font: 30px/1.15 var(--font-display); margin: 36px 0 20px; }
  .asset-overview :global(h3) { font: 23px/1.2 var(--font-display); margin-bottom: 12px; }
  .asset-overview :global(p) { line-height: 1.5; margin-bottom: 16px; }
  .asset-overview :global(.asset-grid) { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 20px; margin: 20px 0 36px; }
  .asset-overview :global(.asset-card) { min-width: 0; overflow-wrap: anywhere; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 12px; padding: 16px; }
  .asset-overview :global(.asset-card img) { width: 100%; height: 180px; object-fit: contain; background: color-mix(in srgb, currentColor 5%, transparent); margin-bottom: 16px; border-radius: 6px; }
  .asset-overview :global(.asset-card small) { display: block; margin-top: 8px; opacity: .7; }
  .asset-overview :global(.asset-social) { border-color: var(--accent); }
  .asset-overview :global(.asset-links) { display: flex; flex-wrap: wrap; gap: 12px 24px; margin-bottom: 24px; }
  @media (prefers-color-scheme: dark) { .asset-overview { background: #171b19; color: #edf0ed; } }
</style>
