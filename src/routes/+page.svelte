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
	import kbr from '../slides/kbr'

	let code: any = $state()
</script>

<!-- <Recorder /> -->

<Presentation options={{ history: true, transition: 'fade', controls: true, progress: true }}>
	<Title
		><h3 class="text-white">KBR & IIIF Maps</h3>
		<br />
		<h2 class="text-3xl text-white">New research & outreach opportunities</h2></Title
	>

	<Slide class="flex h-full flex-col items-center justify-center px-20">
		<h1 class="mb-10 w-full text-7xl font-extrabold tracking-tight">About IIIF</h1>

		<div class="grid w-full items-baseline">
			<div class="text-4xl font-semibold">API for sharing high-definition images</div>
			<br />
			<div class="text-4xl font-semibold">Developped by a consortium of institutions</div>
			<br />
			<div class="text-4xl font-semibold">Image API and Presentation API</div>
		</div>
	</Slide>

	<!-- <MapSlide maps={waag} />

	<MapSlide maps={veningMeinesz} />

	<MapSlide maps={lomanAtlas} />

	<MapSlide maps={surinameTijdMachine} />

	<MapSlide maps={rotterdamHillegom} /> -->

	<MapSlide maps={kbr} />

	<script>
		import { Slide, Action } from 'animotion'
	</script>

	<Slide class="flex h-full flex-col items-center justify-center px-20">
		<h1 class="mb-10 w-full text-7xl font-extrabold tracking-tight">Georeferencing IIIF Maps</h1>

		<div class="grid w-full grid-cols-[1fr_1fr] items-baseline gap-x-12 gap-y-10">
			<div class="text-4xl font-semibold">🔍 Find a IIIF Manifest</div>
			<div class="text-3xl text-gray-500 italic">On institution's permalink page</div>
			<div class="text-4xl font-semibold">👈 Georeference in Allmaps Editor</div>
			<div class="text-3xl text-gray-500 italic">Identify mask and GCPs</div>
			<div class="text-4xl font-semibold">🗺️ Use Georeference Annotation</div>
			<div class="text-3xl text-gray-500 italic">In Viewer, webmaps, storymap, GDAL, ...</div>
		</div>
	</Slide>

	<Slide class="flex h-full flex-col items-center justify-center px-20">
		<h1 class="mb-10 w-full text-7xl font-extrabold tracking-tight">Georeference Annotation</h1>
		<h1 class="mb-10 w-full text-3xl">All info needed to georeference on device</h1>

		<Code
			bind:this={code}
			lang="json"
			theme="github-light"
			class="h-full overflow-y-auto"
			options={{ duration: 600, stagger: 0.3, containerStyle: true }}
			code={`
{
  "id": "https://annotations.allmaps.org/maps/c885f02932de4c78",
  "type": "Annotation",
  "@context": [
    "http://iiif.io/api/extension/georef/1/context.json",
    "http://iiif.io/api/presentation/3/context.json"
  ],
  "motivation": "georeferencing",
  "target": {
    "type": "SpecificResource",
    "source": {
      "id": "https://iiif-image-server.kbr.be/iiif/3/0000%2F0000%2F0056%2F0000_0000_0056_6750.tiff",
      "type": "ImageService3",
      "height": 10730,
      "width": 17546,
    },
    "selector": {
      "type": "SvgSelector",
      "value": "<svg width=\"17546\" height=\"10730\"><polygon points=\"1295,927 1281,9964 16278,9882 16306,904\" /></svg>"
    }
  },
  "body": {
    "type": "FeatureCollection",
    "transformation": {
      "type": "polynomial",
      "options": {
        "order": 1
      }
    },
    "resourceCrs": {
      "name": "EPSG:5637 - TUREF / LCC Europe",
      "definition": "+proj=lcc +lat_1=35 +lat_2=65 +lat_0=52 +lon_0=10 +x_0=4000000 +y_0=2800000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
    },
    "features": [
      {
        "type": "Feature",
        "properties": {
          "resourceCoords": [
            11408,
            8135
          ]
        },
        "geometry": {
          "type": "Point",
          "coordinates": [
            28.974005419759123,
            41.01030262959347
          ]
        }
      },
      {
        "type": "Feature",
        "properties": {
          "resourceCoords": [
            4665,
            9072
          ]
        },
        "geometry": {
          "type": "Point",
          "coordinates": [
            -5.345541916582647,
            36.11186055878348
          ]
        }
      },
      {
        "type": "Feature",
        "properties": {
          "resourceCoords": [
            10693,
            3572
          ]
        },
        "geometry": {
          "type": "Point",
          "coordinates": [
            30.368511028812975,
            59.939271368013806
          ]
        }
      }
    ],
    "_allmaps": {
      "id": "https://annotations.allmaps.org/maps/c885f02932de4c78",
      "version": "https://annotations.allmaps.org/maps/c885f02932de4c78@7519056039e3b060",
      "image": {
        "id": "https://annotations.allmaps.org/images/b54a5a1afc96c9c5",
        "version": "https://annotations.allmaps.org/images/b54a5a1afc96c9c5@ab237a5c12dcac1e",
        "canvases": [
          {
            "id": "https://annotations.allmaps.org/canvases/94f2c06a771aabca",
            "manifests": [
              {
                "id": "https://annotations.allmaps.org/manifests/7f4fec9588a7e77a"
              }
            ]
          }
        ]
      },
      "scale": 0.002132,
      "area": 29745220479995.84
    }
  }
}
			`}
		/>

		<Action
			do={async () => {
				await code.scrollToLine`13`
				code.selectLines`13`
			}}
		/>
		<Action
			do={async () => {
				await code.scrollToLine`19`
				code.selectLines`18-21`
			}}
		/>
		<Action
			do={async () => {
				await code.scrollToLine`27`
				code.selectLines`25-29`
			}}
		/>
		<Action
			do={async () => {
				await code.scrollToLine`32`
				code.selectLines`31-34`
			}}
		/>
		<Action
			do={async () => {
				await code.scrollToLine`43`
				code.selectLines`36-50`
			}}
		/>
	</Slide>

	<Slide class="flex h-full flex-col items-center justify-center px-20">
		<h1 class="mb-10 w-full text-7xl font-extrabold tracking-tight">Allmaps principles</h1>

		<div class="grid w-full grid-cols-[1fr_1fr] items-baseline gap-x-12 gap-y-10">
			<div class="text-4xl font-semibold">🏛️ Funded by institutions</div>
			<div class="text-3xl text-gray-500 italic">Ad hoc + through IIIF Consortium</div>
			<div class="text-4xl font-semibold">🗃️ Open Data stays open</div>
			<div class="text-3xl text-gray-500 italic">Reuse single source, link open data</div>
			<div class="text-4xl font-semibold">👐 Open Source you can host</div>
			<div class="text-3xl text-gray-500 italic">No vendor lock-in</div>
			<div class="text-4xl font-semibold">📲 Images processed on device</div>
			<div class="text-3xl text-gray-500 italic">No reliance on Allmaps servers</div>
		</div>
	</Slide>

	<Slide class="flex h-full flex-col items-center justify-center px-20">
		<h1 class="mb-10 w-full text-7xl font-extrabold tracking-tight">KBR and IIIF Maps</h1>
		<h1 class="mb-10 w-full text-3xl">Research & outreach possibilities?</h1>

		<div class="grid w-full grid-cols-[1fr_1fr] items-baseline gap-x-12 gap-y-10">
			<div class="text-4xl font-semibold">Georeferencing (entire?) map</div>
			<div class="text-3xl text-gray-500 italic">Automation? Crowdsourcing?</div>
			<div class="text-4xl font-semibold">Studying historical maps</div>
			<div class="text-3xl text-gray-500 italic">Distortion measures?</div>
			<div class="text-4xl font-semibold">Linking other data</div>
			<div class="text-3xl text-gray-500 italic">Gazetteer?</div>
			<div class="text-4xl font-semibold">Use in outreach</div>
			<div class="text-3xl text-gray-500 italic">Storytelling? Dedicated website?</div>
		</div>
	</Slide>
</Presentation>
