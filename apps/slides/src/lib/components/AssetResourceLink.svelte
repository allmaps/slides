<script lang="ts">
  import { onMount } from "svelte";
  import { env } from "$env/dynamic/public";
  import { Check, Copy } from "@lucide/svelte";
  import allmapsLogo from "$lib/assets/allmaps-logo-inverted.svg";
  import TheseusLogo from "$lib/components/TheseusLogo.svelte";
  import { withBaseUrl } from "$lib/shared/paths";
  import { absolutePublicUrl } from "$lib/shared/seo";
  import type { InterfaceText } from "$lib/shared/interface-settings";

  let { resource, label, kind, viewers = false, t }: {
    resource: string; label: string; kind?: string; viewers?: boolean; t: InterfaceText;
  } = $props();
  let origin = $state("");
  let copied = $state(false);
  let copyFailed = $state(false);
  let reset: ReturnType<typeof setTimeout> | undefined;
  const href = $derived(withBaseUrl(resource));
  // Published links work without JS. After mounting, local previews use the
  // current host/port, just like the resource link itself.
  const url = $derived(origin ? new URL(href, origin).href : absolutePublicUrl(resource, env.PUBLIC_URL));
  onMount(() => {
    origin = window.location.origin;
    return () => clearTimeout(reset);
  });
  async function copy() {
    clearTimeout(reset);
    copied = false;
    copyFailed = false;
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.href).href);
      copied = true;
      reset = setTimeout(() => { copied = false; }, 2000);
    } catch { copyFailed = true; }
  }
</script>

<div class="resource-row">
  <a class="resource-title" {href}><span>{label}</span>{#if kind}<span class="resource-kind">{kind}</span>{/if}</a>
  <div class="resource-actions">
    <button type="button" onclick={copy} title={t(copied ? "copiedUrl" : "copyUrl")} aria-label={`${t(copied ? "copiedUrl" : "copyUrl")}: ${label}${kind ? ` (${kind})` : ""}`}>
      {#if copied}<Check size={18} aria-hidden="true" />{:else}<Copy size={18} aria-hidden="true" />{/if}
    </button>
    {#if viewers && url}
      <a href={`https://editor.allmaps.org/mask?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
        <span class="allmaps-mark" style={`--allmaps-logo: url("${allmapsLogo}")`} aria-hidden="true"></span>{t("allmapsEditor")}
      </a>
      <a href={`https://theseusviewer.org/?iiif-content=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
        <TheseusLogo />{t("theseusViewer")}
      </a>
    {/if}
  </div>
  <span class="sr-only" role="status">{copied ? t("copiedUrl") : ""}</span>
  {#if copyFailed}
    <label class="copy-fallback">{t("copyUrlManually")}
      <input readonly value={url} aria-label={t("resourceUrl")} onclick={(event) => event.currentTarget.select()} />
    </label>
  {/if}
</div>

<style>
  .resource-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
  .resource-title { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; min-width: 0; overflow-wrap: anywhere; }
  .resource-kind { font-size: 13px; opacity: .65; }
  .resource-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
  .resource-actions button, .resource-actions a { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; border-radius: 6px; }
  .resource-actions button { width: 40px; cursor: pointer; }
  .resource-actions a { font-size: 14px; }
  .allmaps-mark { width: 24px; height: 24px; flex: none; background: currentColor; mask: var(--allmaps-logo) center / contain no-repeat; }
  .resource-actions button:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
  .resource-actions :is(button, a):focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .copy-fallback { flex-basis: 100%; font-size: 14px; }
  .copy-fallback input { display: block; width: 100%; padding: 8px; border: 1px solid currentColor; border-radius: 4px; }
</style>
