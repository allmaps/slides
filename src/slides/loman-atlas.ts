import type { MapSlideProps } from '$lib/types'

const slides: MapSlideProps[] = [
	{
		hideBackground: true,
		// sprite: {
		// 	json: 'loman-atlas.json',
		// 	image: 'loman-atlas.webp',
		// 	dimensions: [903, 908]
		// },
		annotations: [
			{
				url: 'https://annotations.allmaps.org/images/7936d9f015e49c54',
				caption: 'Loman Atlas',
				bearing: true,
				options: {
					applyMask: false,
					renderAppliableMask: false,
					renderGcps: false,
					transformationType: 'helmert'
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/images/7936d9f015e49c54',
				caption: 'Loman Atlas',
				bearing: true,
				options: {
					applyMask: false,
					renderAppliableMask: true,
					renderGcps: false,
					debugTiles: false,
					transformationType: 'helmert'
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/images/7936d9f015e49c54',
				caption: 'Loman Atlas',
				bearing: true,
				options: {
					applyMask: false,
					renderAppliableMask: true,
					renderGcps: true,
					transformationType: 'helmert'
				}
			}
		]
	},
	{
		padding: 200,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/images/7936d9f015e49c54',
				caption: 'Loman Atlas',
				options: {
					applyMask: true,
					renderAppliableMask: false,
					renderGcps: true,
					transformationType: 'polynomial'
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/manifests/af012d4792961902',
				caption: 'Loman Atlas',
				options: {
					transformationType: 'polynomial',
					renderAppliableMask: false,
					removeColor: false,
					renderGcps: false
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/manifests/af012d4792961902',
				caption: 'Loman Atlas',
				options: {
					transformationType: 'polynomial',
					removeColor: false,
					renderAppliableMask: true,
					renderAppliableMaskSize: 4,
					saturation: 1
				}
			}
		]
	},
	{
		location: {
			zoom: 17,
			center: [4.899895, 52.359702]
		},
		annotations: [
			{
				url: 'https://annotations.allmaps.org/manifests/af012d4792961902',
				caption: 'Loman Atlas',
				options: {
					transformationType: 'polynomial',
					renderAppliableMask: false,
					removeColor: true,
					removeColorColor: '#EEDECA',
					removeColorThreshold: 0.2,
					saturation: 0
				}
			}
		]
	},
	// Plattegronden Rijks
	// https://id.rijksmuseum.nl/200747711
	// https://sammeltassen-rijks.web.val.run/200747711
	// https://annotations.allmaps.org/maps/fedf952c51cb5d1a (1916)
	// https://id.rijksmuseum.nl/200101732
	// https://sammeltassen-rijks.web.val.run/200101732
	// https://annotations.allmaps.org/maps/4e838295a6f98db5 (1864 - 1904)
	// https://id.rijksmuseum.nl/200739835
	// https://sammeltassen-rijks.web.val.run/200739835
	// https://annotations.allmaps.org/maps/f718b9dd00fe20ab (1855 - 1865)
	// https://id.rijksmuseum.nl/200601811
	// https://sammeltassen-rijks.web.val.run/200601811
	// https://annotations.allmaps.org/images/91418b2b2ddc304f (1865)
	{
		location: {
			zoom: 18,
			center: [4.899895, 52.359702]
		},
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/4e838295a6f98db5',
				caption: '1855 - 1865',
				options: {
					renderGcps: true
				}
			},
			{
				url: 'https://annotations.allmaps.org/manifests/af012d4792961902',
				caption: 'Loman Atlas',
				options: {
					transformationType: 'polynomial',
					renderAppliableMask: false,
					removeColor: true,
					removeColorColor: '#EEDECA',
					removeColorThreshold: 0.2,
					saturation: 0
				}
			}
		]
	},
	{
		freeze: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/images/91418b2b2ddc304f ',
				caption: '1865'
			},
			{
				url: 'https://annotations.allmaps.org/maps/4e838295a6f98db5',
				caption: '1855 - 1865',
				options: {
					renderGcps: false
				}
			},
			{
				url: 'https://annotations.allmaps.org/manifests/af012d4792961902',
				caption: 'Loman Atlas',
				options: {
					transformationType: 'polynomial',
					renderAppliableMask: false,
					removeColor: true,
					removeColorColor: '#EEDECA',
					removeColorThreshold: 0.2,
					saturation: 0
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/fedf952c51cb5d1a',
				caption: '1916'
			}
		]
	},
	// {
	// 	hideBackground: true,
	// 	annotations: [
	// 		{
	// 			url: 'https://annotations.allmaps.org/maps/77bd3f8de28ec636@0189a9277ce92fe0',
	// 			caption: 'OverHolland 1850',
	// 			options: {
	// 				removeColor: false,
	// 				applyMask: false
	// 			}
	// 		}
	// 	]
	// },
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/77bd3f8de28ec636@0189a9277ce92fe0',
				caption: 'OverHolland 1850',
				options: {
					applyMask: true,
					removeColor: true,
					removeColorColor: '#FFFFFF',
					removeColorThreshold: 0.2,
					colorize: false,
					saturation: 1
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/70f0d78d7f7256ef@77844fa89cb06672',
				caption: 'OverHolland 1910',
				options: {
					removeColor: true,
					removeColorColor: '#FFFFFF',
					removeColorThreshold: 0.2,
					colorize: false,
					saturation: 1
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/a10779081d3ce8de@72f335fab29ebee6',
				caption: 'OverHolland 1940',
				options: {
					removeColor: true,
					removeColorColor: '#FFFFFF',
					removeColorThreshold: 0.2,
					colorize: false,
					saturation: 1,
					applyMask: true
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/a10779081d3ce8de@72f335fab29ebee6',
				caption: 'OverHolland 1940',
				options: {
					removeColor: false,
					colorize: false,
					saturation: 1,
					applyMask: false
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/77bd3f8de28ec636@0189a9277ce92fe0',
				caption: 'OverHolland 1850',
				options: {
					removeColor: true,
					removeColorColor: '#FFFFFF',
					removeColorThreshold: 0.2,
					saturation: 0,
					colorize: true,
					colorizeColor: '#FF00FF'
				}
			},
			{
				url: 'https://annotations.allmaps.org/maps/70f0d78d7f7256ef@77844fa89cb06672',
				caption: 'OverHolland 1910',
				options: {
					removeColor: true,
					removeColorColor: '#FFFFFF',
					removeColorThreshold: 0.2,
					saturation: 0,
					colorize: true,
					colorizeColor: '#0000FF'
				}
			},
			{
				url: 'https://annotations.allmaps.org/maps/a10779081d3ce8de@72f335fab29ebee6',
				caption: 'OverHolland 1940',
				options: {
					removeColor: true,
					removeColorColor: '#FFFFFF',
					removeColorThreshold: 0.2,
					saturation: 0,
					colorize: true,
					colorizeColor: '#FF0000',
					applyMask: true
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/1afc4e6255543030@86fcb103f5f192cc',
				caption: 'OverHolland 1970',
				options: {
					removeColor: true,
					removeColorColor: '#FFFFFF',
					removeColorThreshold: 0.2
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/0bd9c3d90a7c93c7@702f389bd229930f',
				caption: 'OverHolland 2000',
				options: {
					removeColor: true,
					removeColorColor: '#FFFFFF',
					removeColorThreshold: 0.2
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/2911615ac116792b@1df51974cbe30fc1',
				caption: 'OverHolland 2030',
				options: {
					applyMask: true,
					removeColor: true,
					removeColorColor: '#FFFFFF',
					removeColorThreshold: 0.2
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/2911615ac116792b@1df51974cbe30fc1',
				caption: 'OverHolland 2030',
				options: {
					applyMask: false,
					removeColor: false
				}
			}
		]
	}

	// {
	// 	annotations: [
	// 		{
	// 			url: 'https://annotations.allmaps.org/maps/f718b9dd00fe20ab',
	// 			caption: '1864 - 1904'
	// 		}
	// 	]
	// }
]

export default slides
