<script lang="ts">
  import buildInfo from "virtual:slides/build-info";
  import { getInterfaceText } from "$lib/shared/interface-context";
  import { withBaseUrl } from "$lib/shared/paths";
  import MadeWith from "$lib/components/MadeWith.svelte";
  let { isDarkMode }: { isDarkMode: boolean } = $props();
  const t = getInterfaceText();
  const licenseRef = buildInfo.sourceState === "clean" && buildInfo.revision ? buildInfo.revision : "main";
  const licenseUrl = buildInfo.repositoryUrl
    ? `${buildInfo.repositoryUrl}/blob/${licenseRef}/LICENSE.md`
    : withBaseUrl("licenses/NOTICE.txt");
</script>

<footer class="software-credits mt-6 border-t border-current/15 pt-6 pb-2 text-center text-[16px] leading-relaxed" data-software-credits>
  <MadeWith {isDarkMode} href={buildInfo.repositoryUrl} logoInheritsColor />
  <p class="mt-2">{buildInfo.version}</p>
  {#if buildInfo.sourceState === "modified"}
    <p>{t("softwareModifiedBuild")}</p>
  {:else if buildInfo.development || buildInfo.sourceState === "unknown"}
    <p>{t("softwareDevelopmentBuild")}</p>
  {/if}
  {#if buildInfo.customApp}<p>{t("softwareCustomApp")}</p>{/if}
  <ul class="mt-2 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0">
    {#if buildInfo.applicationSourceUrl}
      <li><a href={buildInfo.applicationSourceUrl} target="_blank" rel="noopener noreferrer">{t("softwareSource")}</a></li>
    {/if}
    {#if buildInfo.releaseNotesUrl}
      <li><a href={buildInfo.releaseNotesUrl} target="_blank" rel="noopener noreferrer">{t("softwareReleaseNotes")}</a></li>
    {/if}
    <li><a href={licenseUrl} target="_blank" rel="noopener noreferrer">{t("softwareLicenses")}</a></li>
  </ul>
</footer>

<style>
  .software-credits {
    --made-with-color: var(--app-text);
    color: var(--app-text);
  }
  a { text-decoration: none; }
  a:hover { color: var(--app-text); }
</style>
