<script lang="ts">
  import AllmapsLogo from "$lib/components/AllmapsLogo.svelte";
  import { getInterfaceText } from "$lib/shared/interface-context";

  let { isDarkMode, label, href }: {
    isDarkMode: boolean;
    label?: string;
    href?: string;
  } = $props();
  const t = getInterfaceText();
</script>

<p class="made-with">
  <span class="label">{label ?? t("madeWith")}</span>
  <span class="product">
    <AllmapsLogo inverted={isDarkMode} alt="" aria-hidden="true" />
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
    color: var(--app-interface-grey);
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

  .made-with :global(.allmaps-logo) {
    width: 2rem;
    height: 2rem;
    opacity: 0.2;
  }

  :global(.dark) .made-with { color: rgb(255 255 255 / 0.8); }
  :global(.dark) .made-with :global(.allmaps-logo) { opacity: 0.8; }

  @media (max-width: 639px) {
    .made-with { font-size: 1rem; }
  }
</style>
