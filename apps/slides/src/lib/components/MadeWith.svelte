<script lang="ts">
  import AllmapsLogo from "$lib/components/AllmapsLogo.svelte";
  import allmapsMark from "$lib/assets/allmaps-logo-inverted.svg";
  import { getInterfaceText } from "$lib/shared/interface-context";

  let { isDarkMode, label, href, logoInheritsColor = false }: {
    isDarkMode: boolean;
    label?: string;
    href?: string;
    logoInheritsColor?: boolean;
  } = $props();
  const t = getInterfaceText();
</script>

<p class="made-with">
  <span class="label">{label ?? t("madeWith")}</span>
  <span class="product">
    {#if logoInheritsColor}
      <span class="allmaps-mark" style={`--allmaps-logo: url("${allmapsMark}")`} aria-hidden="true"></span>
    {:else}
      <AllmapsLogo inverted={isDarkMode} alt="" aria-hidden="true" />
    {/if}
    {#if href}
      <a class="label" {href} target="_blank" rel="noopener noreferrer">{t("productName")}</a>
    {:else}
      <span class="label">{t("productName")}</span>
    {/if}
  </span>
</p>

<style>
  .made-with {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin: 0;
    color: var(--made-with-color, var(--app-interface-grey));
    font-size: 1.25rem;
    font-weight: 500;
    line-height: 1.1;
  }

  .product {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .label { transform: translateY(0.06em); }
  a { text-decoration: none; }
  a:hover { color: var(--app-text); }

  .allmaps-mark,
  .made-with :global(.allmaps-logo) {
    width: 2rem;
    height: 2rem;
  }

  .allmaps-mark {
    flex: none;
    background: currentColor;
    mask: var(--allmaps-logo) center / contain no-repeat;
  }

  .made-with :global(.allmaps-logo) { opacity: 0.2; }

  :global(.dark) .made-with { color: var(--made-with-color, rgb(255 255 255 / 0.8)); }
  :global(.dark) .made-with :global(.allmaps-logo) { opacity: 0.8; }

  @media (max-width: 639px) {
    .made-with { font-size: 1rem; }
  }
</style>
