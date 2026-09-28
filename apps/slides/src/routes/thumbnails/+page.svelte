<script lang="ts">
  import AssetOverview from "$lib/components/AssetOverview.svelte";
  import ThumbnailToc from "$lib/components/ThumbnailToc.svelte";
  import { project } from "$lib/shared/content-package";
  import { createInterfaceText } from "$lib/shared/interface-settings";
  import { thumbnailOverview, thumbnailShowAnchor, thumbnailSlideAnchor, type OverviewImage } from "$lib/shared/thumbnail-overview";
  import { getChapterLabel } from "@allmaps/slides/model/project";
  import { withBaseUrl } from "$lib/shared/paths";
  let { data } = $props();
  const t = createInterfaceText(() => project.interface);
  const shows = $derived(thumbnailOverview(project, data.thumbnails));
  const hasImages = $derived(shows.some(show => show.startImages.length || show.chapters.some(chapter => chapter.images.length)));
</script>
{#snippet cards(images: OverviewImage[], title: string)}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrollable region needs keyboard focus for arrow-key scrolling.) -->
  <div class="thumbnail-row" role="region" aria-label={t("thumbnailsForTitle", { title })} tabindex={images.length ? 0 : undefined}>
    {#each images as preview}
      <figure class="asset-card" class:asset-social={preview.social}>
        <a href={withBaseUrl(preview.image.path)}><img src={withBaseUrl(preview.image.path)} alt={`${title} — ${t(preview.label, { count: preview.count ?? 0 })}`} loading="lazy" /></a>
        <figcaption>{t(preview.label, { count: preview.count ?? 0 })}<small>{t("imageDimensions", preview.image)}</small></figcaption>
      </figure>
    {:else}<p>{t("noGeneratedImages")}</p>{/each}
  </div>
{/snippet}
<AssetOverview {project} title={t("thumbnailsOverview")}>
  <p>{t("thumbnailsDescription")}</p>
  {#if !data.generation.thumbnails}
    <p>{t("generationDisabled", { name: t("thumbnailsOverview") })}</p>
  {:else if !hasImages}
    <p>{t("noGeneratedImages")}</p><p>{t("generateThumbnailsHint")}</p>
  {:else}
    <ThumbnailToc {project} {shows} {t} />
    {#each shows as show, showIndex}
      <section>
        <h2 id={thumbnailShowAnchor(showIndex)}>{show.title}</h2>
        {#if show.startImages.length}
          <h3 id={thumbnailSlideAnchor(showIndex, "start")}>{t("thumbnailStart")}</h3>
          {@render cards(show.startImages, t("thumbnailStart"))}
        {/if}
        {#each show.chapters as chapter, index}
          <h3 id={thumbnailSlideAnchor(showIndex, index)}><a href={`${withBaseUrl(show.slug)}${index ? `#${encodeURIComponent(chapter.slug)}` : ""}`}>{getChapterLabel(project, show, chapter.slug)}. {chapter.title}</a></h3>
          {@render cards(chapter.images, chapter.title)}
        {/each}
      </section>
    {/each}
  {/if}
</AssetOverview>

<style>
  h2, h3 { scroll-margin-top: 24px; }
  .thumbnail-row { display: flex; gap: 16px; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x proximity; padding: 2px 2px 12px; margin: 16px 0 36px; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 25%, transparent) transparent; }
  .thumbnail-row:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 12px; }
  .thumbnail-row .asset-card { flex: 0 0 min(280px, 85%); scroll-snap-align: start; }
</style>
