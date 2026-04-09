<script lang="ts">
	import { Action, Slide } from '@animotion/core'
	import Map from './Map.svelte'
	import type { MapSlideProps } from './types'

	type Props = {
		maps: MapSlideProps[]
	}

	const { maps }: Props = $props()

	let index: number = $state(0)
	let init: boolean = $state(true)
	let previousIndex = 0
	let currentSlide = $derived(maps[index])
	let currentAnnotations = $derived(currentSlide.annotations)
	let highlight: string | undefined = $state(undefined)

	const resetIndex = () => (index = 0)
	const resetInit = () => (init = true)
	const highlightMap = (e: MouseEvent | FocusEvent) => {
		const elem = e.target as HTMLElement
		if (e.type === 'mouseover' || e.type === 'focus') {
			highlight = elem.dataset.annotation
		} else {
			highlight = undefined
		}
	}

	let actions = $derived(
		maps?.slice(1).map((_, i) => () => {
			previousIndex = index
			index = i + 1
			if (maps.length > 2 && index === maps.length - 1 && previousIndex === 0) {
				// When moving backwards after a refresh...
				// Slide is always initiated at 0
				init === true
			} else {
				init = false
			}
		})
	)
</script>

<Slide in={resetInit} out={resetInit}>
	<div>
		<Map {maps} {index} {init} {highlight} />
		{#if actions?.length}
			<Action undo={resetIndex} {actions} />
		{/if}
		{#if currentAnnotations}
			<div class="absolute bottom-0 mb-5 flex h-auto w-full items-center justify-center text-base">
				<div class="max-w-lg rounded-lg border border-solid bg-white p-2 text-left">
					<ul>
						{#each currentAnnotations as annotation}
							<li class="ml-4">
								<a
									data-annotation={annotation.url}
									class="text-black no-underline hover:underline"
									onmouseover={highlightMap}
									onmouseout={highlightMap}
									onfocus={highlightMap}
									onblur={highlightMap}
									href={annotation.homepage}
									>{annotation.caption ? annotation.caption : 'No caption'}</a
								>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		{/if}
	</div>
</Slide>
