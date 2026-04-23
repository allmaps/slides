import type { MapSlideProps } from '$lib/types.js'

export default [
	{
		hideBackground: false,
		annotations: [
			{
				caption:
					'Historisch kaartje van Amsterdam met de houten palissade uit 1400, uitgave Covens en Mortier, tweede kwart 18e eeuw',
				bearing: true,
				url: 'https://annotations.allmaps.org/maps/14705db543a7d4e7@76dbbb9226173e27',
				options: {
					applyMask: true,
					transformationType: 'helmert',
					removeColor: false
				}
			}
		]
	},
	{
		hideBackground: false,
		annotations: [
			{
				caption: 'Oude Kerk',
				bearing: false,
				url: 'https://annotations.allmaps.org/maps/efc2aa530e9378a4@d1bc9206d0a78932',
				options: {
					applyMask: true,
					transformationType: 'polynomial',
					removeColor: false
				}
			}
		]
	},
	{
		location: {
			center: [4.8924534, 52.3730796],
			zoom: 13
		},
		sources: {
			buildings: {
				type: 'raster',
				tiles: ['https://rtiles.waag.org/services/buildings/tiles/{z}/{x}/{y}'],
				maxzoom: 40
			}
		},
		annotations: []
	}
] satisfies MapSlideProps[]
