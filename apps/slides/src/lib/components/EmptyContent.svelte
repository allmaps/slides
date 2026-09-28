<script lang="ts">
  import AssetOverview from "./AssetOverview.svelte";
  import type { Project } from "$lib/shared/types";
  import { createInterfaceText } from "$lib/shared/interface-settings";
  import { withBaseUrl } from "$lib/shared/paths";
  let { project, generation }: { project: Project; generation: { iiif: boolean } } = $props();
  const t = createInterfaceText(() => project.interface);
</script>
<AssetOverview {project} title={t("noContent")}>
  <p>{t(generation.iiif ? "noContentDescription" : "noContentWithoutIiif")}</p>
  {#if generation.iiif}<a href={withBaseUrl("iiif/")}>{t("iiifOverview")} →</a>{/if}
</AssetOverview>
