import type { MapLibreWarpedMapLayerOptions } from '@allmaps/maplibre'
import maplibregl from 'maplibre-gl'

export type MapSlideProps = {
	location?: {
		zoom?: number
		center?: [number, number]
		duration?: number
		bearing?: number
	}
	sprite?: {
		json: string
		image: string
		dimensions: [number, number]
	}
	freeze?: boolean
	padding?: number
	hideBackground?: boolean
	contain?: boolean
	sources?: {
		[key: string]: maplibregl.SourceSpecification
	}
	annotations?: {
		url: string
		caption?: string
		bearing?: boolean
		options?: Partial<MapLibreWarpedMapLayerOptions>
	}[]
	geojsons?: {
		url: string
	}[]
}
