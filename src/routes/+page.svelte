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
	import test from '../slides/test'
	import buildings from '../slides/buildings'
	import cartouche from '../slides/cartouche'
	import spoorkaart from '../slides/spoorkaart'
</script>

<!-- <Recorder /> -->

<Presentation options={{ history: true, transition: 'fade', controls: true, progress: true }}>
	<Title><h3 class="text-white">Allmaps Slides Demo</h3></Title>
	<MapSlide maps={lomanAtlas} />
	<MapSlide maps={rotterdamHillegom} />
	<MapSlide maps={veningMeinesz} />
	<MapSlide maps={spoorkaart} />
</Presentation>
