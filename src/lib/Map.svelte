<script lang="ts">
	import { onMount } from 'svelte'
	import maplibregl from 'maplibre-gl'
	import { WarpedMapLayer } from '@allmaps/maplibre'
	import colors from './colors'
	import { computeWarpedMapBearing } from '@allmaps/bearing'
	import { getAxisAlignedBboxAndCenter, getNarrowBbox } from './helpers'
	import { bboxPolygon } from '@turf/turf'
	import { featureCollection } from '@turf/turf'

	import type { MapSlideProps } from './types'

	import 'maplibre-gl/dist/maplibre-gl.css'
	import { mapToResourceMaskSvgPolygon } from '@allmaps/stdlib'

	const { index, maps, init } = $props()

	const DURATION = 2000
	const PADDING = 25
	// https://tiles.openfreemap.org/styles/liberty
	const STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'

	let currentSlide = $derived(maps[index]) as MapSlideProps
	let location = $derived(currentSlide.location ? currentSlide.location : {})
	let freeze = $derived(currentSlide.freeze)
	let hideBackground = $derived(currentSlide.hideBackground)
	let slideDuration = $derived(currentSlide.location?.duration)
	let slidePadding = $derived(currentSlide.padding)
	let slideContain = $derived(currentSlide.contain)
	let slideSources = $derived(currentSlide.sources)
	let annotations = $derived(
		currentSlide.annotations?.length ? currentSlide.annotations : undefined
	)
	let sprite = $derived(currentSlide.sprite)

	let map: maplibregl.Map
	let container: HTMLElement
	let mapLoaded = $state(false)
	let mapIdsByAnnotationUrl = new Map()
	let visibleMaps: string[] = new Array()
	let visibleLayers: Set<string> = new Set()

	// For debugging
	const debug = false
	const useVisibility = false

	const warpedMapLayer = new WarpedMapLayer(useVisibility ? { visible: false } : undefined)

	function toggleVisibility(event: KeyboardEvent) {
		if (event.repeat) return
		if (mapLoaded && event.code === 'Backquote') {
			const opacity = warpedMapLayer.getOpacity()
			if (opacity === 0) {
				warpedMapLayer.setOpacity(1)
			} else {
				warpedMapLayer.setOpacity(0)
			}
		}
	}

	const loadAnnotations = async (maps: MapSlideProps[]) => {
		const allUrls = maps
			.map((i) => i.annotations)
			.flatMap((annotations) =>
				annotations ? annotations.map((annotation) => annotation.url) : []
			)
		const uniqueUrls = [...new Set(allUrls)]
		if (uniqueUrls.length) {
			const promises = uniqueUrls.map((url: string) => {
				return warpedMapLayer
					.addGeoreferenceAnnotationByUrl(url, useVisibility ? { visible: false } : { opacity: 0 })
					.then((ids) => {
						mapIdsByAnnotationUrl.set(url, ids)
					})
			})
			await Promise.all(promises)
		}
	}

	$effect(() => {
		if (mapLoaded) {
			const sourceIds = slideSources ? Object.keys(slideSources) : []
			visibleLayers.forEach((id) => {
				if (!sourceIds.includes(id)) {
					map.removeLayer(id)
					visibleLayers.delete(id)
				}
			})
			if (slideSources) {
				Object.entries(slideSources).forEach(([id, source]) => {
					// Currently only supporting raster and geojson layers
					const layerType =
						source.type === 'raster' ? 'raster' : source.type === 'geojson' ? 'line' : undefined
					if (!map.getSource(id)) {
						map.addSource(id, source)
					}
					if (layerType && !visibleLayers.has(id)) {
						const layerOptions: maplibregl.LayerSpecification = {
							id,
							type: layerType,
							source: id
						}
						if (layerType === 'line') {
							layerOptions.layout = {
								'line-join': 'round',
								'line-cap': 'round'
							}
							layerOptions.paint = {
								'line-color': colors.green.stroke,
								'line-width': 8
							}
						}
						map.addLayer(layerOptions, layerType === 'raster' ? 'warped-map-layer' : undefined)
					}
					visibleLayers.add(id)
				})
			}
		}
	})

	$effect(() => {
		if (mapLoaded && location && !freeze && !annotations) {
			const flyToOptions = {
				duration: init ? 0 : DURATION,
				...location
			}
			map.flyTo(flyToOptions)
		}
	})

	$effect(() => {
		if (mapLoaded && hideBackground) {
			map.setPaintProperty('white-background', 'background-opacity', 1)

			for (const layer of map.getLayersOrder()) {
				if (layer !== warpedMapLayer?.id) {
					map.setLayoutProperty(layer, 'visibility', 'none')
				}
			}
		} else if (mapLoaded) {
			map.setPaintProperty('white-background', 'background-opacity', 0)

			for (const layer of map.getLayersOrder()) {
				if (layer !== warpedMapLayer?.id) {
					map.setLayoutProperty(layer, 'visibility', 'visible')
				}
			}
		}
	})

	$effect(() => {
		if (mapLoaded && annotations) {
			// Get all IDs
			const optionsByMapId = new Map()
			const newMapIds = new Array()
			annotations
				.slice()
				// For correct order
				.reverse()
				.forEach((annotation) => {
					const { url, options } = annotation
					const annotationIds = mapIdsByAnnotationUrl.get(url)
					warpedMapLayer.bringMapsToFront(annotationIds)
					annotationIds.forEach((id: string) => {
						optionsByMapId.set(
							id,
							useVisibility
								? { visible: true, renderPoints: true, renderLines: true, ...options }
								: { opacity: 1, renderPoints: true, renderLines: true, ...options }
						)
						if (!visibleMaps.includes(id)) {
							// No longer used!
							newMapIds.push(id)
						}
					})
				})

			// Check which maps to hide and show
			// const mapsToShow = mapIds.filter((id) => !visibleMaps.includes(id))
			const mapsToHide = visibleMaps.filter((id) => !optionsByMapId.has(id))
			const mapIds = optionsByMapId.keys().toArray()

			warpedMapLayer.resetMapsOptions(mapsToHide)
			mapsToHide.forEach((id) => {
				optionsByMapId.set(
					id,
					useVisibility
						? { visible: false }
						: {
								opacity: 0,
								renderPoints: false,
								renderLines: false
							}
				)
			})
			// Animation not working correctly
			// const animate = init ? false : slideDuration === 0 ? false : true
			warpedMapLayer.setMapsOptionsByMapId(optionsByMapId)

			visibleMaps = mapIds

			// Get bounds of visible maps
			let bounds = warpedMapLayer.getMapsBbox(mapIds, { projection: { definition: 'EPSG:4326' } })
			// Get optional bearing for map
			let bearing = 0
			let center: maplibregl.LngLat | undefined

			const firstMapWithBearingProp = annotations.find((annotation) => annotation.bearing == true)
			if (firstMapWithBearingProp) {
				const warpedMapIds = mapIdsByAnnotationUrl.get(firstMapWithBearingProp.url)
				const warpedMap = warpedMapLayer.getWarpedMap(warpedMapIds[0])

				const geoMasks = mapIds
					.map((id) => {
						const warpedMap = warpedMapLayer.getWarpedMap(id)
						if (warpedMap) {
							return warpedMap.geoMask
						}
					})
					.filter(Boolean)

				if (warpedMap) {
					bearing = computeWarpedMapBearing(warpedMap)
					if (location.bearing) {
						// This can be useful if original map is rotated
						bearing = bearing + location.bearing
					}
				}

				;({ bounds, center } = getAxisAlignedBboxAndCenter(geoMasks, bearing))
			}
			if (bounds && slideContain) {
				bounds = getNarrowBbox(bounds)
			}
			if (bounds && debug) {
				const boundsSource = map.getSource('bounds') as maplibregl.GeoJSONSource
				const features = featureCollection([bboxPolygon(bounds)])
				if (boundsSource) {
					boundsSource.setData(features)
				}
			}
			if (bounds && !freeze) {
				const camera = map.cameraForBounds(bounds, {
					padding: slidePadding !== undefined ? slidePadding : PADDING
				})
				// Add optional center if bearing is used
				if (camera && center) {
					camera.center = center
				}
				const flyToOptions = {
					duration: init ? 0 : DURATION,
					...camera,
					// Apply manual overrides
					...location,
					bearing: -bearing
				}
				map.flyTo(flyToOptions)
			}
		} else if (mapLoaded) {
			// Hide all maps
			warpedMapLayer.setMapsOptions(
				visibleMaps,
				useVisibility
					? { visible: false }
					: {
							opacity: 0,
							renderPoints: false,
							renderLines: false
						}
			)
		}
	})

	onMount(() => {
		map = new maplibregl.Map({
			container,
			style: STYLE,
			maxPitch: 0,
			attributionControl: false
		})

		map.keyboard.disable()

		map.on('load', async () => {
			map.addLayer({
				id: 'white-background',
				type: 'background',
				paint: {
					'background-color': '#ffffff',
					'background-opacity': 1,
					'background-opacity-transition': { duration: DURATION }
				}
			})

			// @ts-expect-error
			map.addLayer(warpedMapLayer)
			await loadAnnotations(maps)

			if (debug) {
				// Debug layer to show bounds
				map.addSource('bounds', {
					type: 'geojson',
					data: {
						type: 'FeatureCollection',
						features: []
					}
				})
				map.addLayer({
					id: `bounds-layer`,
					type: 'line',
					source: 'bounds',
					layout: {
						'line-join': 'round',
						'line-cap': 'round'
					},
					paint: {
						'line-color': colors.blue.stroke,
						'line-width': 8
					}
				})
			}

			if (sprite) {
				// Load image sprite before rendering maps
				map.on('maptilesloadedfromsprites', () => {
					mapLoaded = true
				})
				const spriteJson = await fetch(`/sprites/${sprite.json}`).then((resp) => resp.json())
				await warpedMapLayer.addSprites(
					spriteJson,
					window.location.origin + `/sprites/${sprite.image}`,
					sprite.dimensions
				)
			} else {
				mapLoaded = true
			}
		})
	})
</script>

<svelte:window on:keydown={toggleVisibility} on:keyup={toggleVisibility} />

<div class="maplibre h-screen w-screen" bind:this={container}></div>
