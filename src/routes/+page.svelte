<script lang="ts">
	import {
		Presentation,
		Slide,
		Code,
		Transition,
		Action,
		getPresentation,
		Recorder
	} from '@animotion/core'
	import MapSlide from '$lib/MapSlide.svelte'
	import Title from '$lib/Title.svelte'
	import colors from '$lib/colors'

	// Snippets
	import lomanAtlas from '../slides/loman-atlas'
	import rotterdamHillegom from '../slides/rotterdam-hillegom'
	import surinameTijdMachine from '../slides/suriname-tijdmachine'
	import veningMeinesz from '../slides/vening-meinesz'
	import waag from '../slides/waag'
</script>

<!-- <Recorder /> -->

<Presentation options={{ history: true, transition: 'fade', controls: true, progress: true }}>
	<Title><h3 class="text-white">Allmaps Slides</h3></Title>

	<MapSlide maps={waag} />

	<MapSlide maps={veningMeinesz} />

	<MapSlide maps={lomanAtlas} />

	<MapSlide maps={surinameTijdMachine} />

	<MapSlide maps={rotterdamHillegom} />
</Presentation>
