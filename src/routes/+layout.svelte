<script lang="ts">
	import '../styles/app.css'

	let { children } = $props()
</script>

<svelte:head>
	<title>Allmaps Slides</title>
</svelte:head>

{@render children()}
