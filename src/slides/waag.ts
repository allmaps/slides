import type { MapSlideProps } from '$lib/types'

const slides: MapSlideProps[] = [
	{
		location: {
			center: [4.8924534, 52.3730796],
			zoom: 12
		},
		// hideBackground: true,
		sources: {
			buildings: {
				type: 'raster',
				tiles: ['https://rtiles.waag.org/services/buildings/tiles/{z}/{x}/{y}'],
				maxzoom: 40
			}
		},
		annotations: []
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/manifests/9cbe64a02dd57b86',
				options: {
					removeColor: false
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/manifests/9cbe64a02dd57b86',
				options: {
					removeColor: true,
					removeColorColor: '#000',
					removeColorThreshold: 0.2,
					colorize: false
				}
			}
		]
	},
	{
		sources: {
			buildings: {
				type: 'raster',
				tiles: ['https://rtiles.waag.org/services/buildings/tiles/{z}/{x}/{y}'],
				maxzoom: 40
			}
		},
		annotations: [
			{
				url: 'https://annotations.allmaps.org/manifests/9cbe64a02dd57b86',
				options: {
					removeColor: true,
					removeColorColor: '#000',
					removeColorThreshold: 0.2,
					colorize: true,
					colorizeColor: 'ff00ff'
				}
			}
		]
	}
]

export default slides
