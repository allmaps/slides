<script lang="ts">
  import AssetOverview from "$lib/components/AssetOverview.svelte";
  import AssetResourceLink from "$lib/components/AssetResourceLink.svelte";
  import { project } from "$lib/shared/content-package";
  import { createInterfaceText } from "$lib/shared/interface-settings";
  import { withBaseUrl } from "$lib/shared/paths";
  let { data } = $props();
  const t = createInterfaceText(() => project.interface);
  const resource = (request: string) => `iiif/${request.split("/").map(encodeURIComponent).join("/")}`;
  const href = (request: string) => withBaseUrl(resource(request));
</script>
{#snippet manifests()}
  <ul class="manifest-list">
    {#each data.iiif.manifests as manifest}
      <li><AssetResourceLink resource={resource(manifest)} label={data.iiif.manifestLabels[manifest] ?? manifest} kind={t("iiifManifest")} viewers {t} /></li>
    {/each}
  </ul>
{/snippet}
<AssetOverview {project} title={t("iiifOverview")}>
  <p>{t("iiifDescription")}</p>
  {#if !data.generation.iiif}
    <p>{t("generationDisabled", { name: "IIIF" })}</p>
  {:else if !data.iiif.images.length}
    <p>{t("noGeneratedImages")}</p><p>{t("generateIiifHint")}</p>
  {:else}
    <p>{t(data.iiif.images.length === 1 ? "imageCountSingular" : "imageCountPlural", { count: data.iiif.images.length })}</p>
    <nav class="iiif-tree" aria-label={t("iiifManifests")}>
      {#if data.iiif.collection}
        <ul><li>
          <AssetResourceLink resource={resource(data.iiif.collection)} label={data.iiif.collectionLabel ?? project.title} kind={t("iiifCollection")} viewers {t} />
          {@render manifests()}
        </li></ul>
      {:else}{@render manifests()}{/if}
    </nav>
    <div class="asset-grid">
      {#each data.iiif.images as image}
        <article class="asset-card">
          {#if image.preview}<a href={href(image.info)}><img src={href(image.preview)} alt={image.name} loading="lazy" /></a>{/if}
          <h3>{image.name}</h3>
          <p>{t("imageDimensions", { width: image.width, height: image.height })}</p>
          <AssetResourceLink resource={resource(image.info)} label={t("iiifService")} {t} />
          <small>{t("generatedFileCount", { count: image.fileCount })}</small>
        </article>
      {/each}
    </div>
  {/if}
</AssetOverview>

<style>
  .iiif-tree { margin: 28px 0 36px; }
  .manifest-list { display: grid; gap: 8px; }
  .iiif-tree ul ul { margin: 8px 0 0 20px; padding-left: 20px; border-left: 1px solid color-mix(in srgb, currentColor 22%, transparent); }
</style>
