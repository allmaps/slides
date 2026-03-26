<script lang="ts">
	import { Action, Slide } from '@animotion/core'
	import Map from './Map.svelte'
	import type { MapSlideProps } from './types'

	type Props = {
		maps?: MapSlideProps[]
	}

	const { maps }: Props = $props()

	let index: number = $state(0)
	let init: boolean = $state(true)

	const resetIndex = () => (index = 0)
	const resetInit = () => (init = true)

	let actions = $derived(
		maps?.slice(1).map((_, i) => () => {
			index = i + 1
			if (index !== maps.length - 2) {
				init = false
			}
		})
	)
</script>

<Slide in={resetInit} out={resetInit}>
	<div>
		<Map {maps} {index} {init} />
		{#if actions?.length}
			<Action undo={resetIndex} {actions} />
		{/if}
	</div>
</Slide>
