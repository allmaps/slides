import type { MapSlideProps } from '$lib/types.js'

export default [
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://gist.githubusercontent.com/sammeltassen/fa3dbfaf4dfa800e00824478c4bd1928/raw/79b2a1a9e864238c988278899555812dd90390f7/nl-railway-map-polynomial.json',
				caption: 'Spoorkaart van Nederland',
				homepage: 'https://www.ns.nl',
				bearing: true,
				options: {
					transformationType: 'helmert',
					applyMask: false
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://gist.githubusercontent.com/sammeltassen/fa3dbfaf4dfa800e00824478c4bd1928/raw/79b2a1a9e864238c988278899555812dd90390f7/nl-railway-map-polynomial.json',
				caption: 'Spoorkaart van Nederland',
				bearing: true,
				options: {
					transformationType: 'helmert',
					applyMask: false,
					renderAppliableMask: true
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://gist.githubusercontent.com/sammeltassen/fa3dbfaf4dfa800e00824478c4bd1928/raw/79b2a1a9e864238c988278899555812dd90390f7/nl-railway-map-polynomial.json',
				caption: 'Spoorkaart van Nederland',
				bearing: true,
				options: {
					transformationType: 'helmert',
					applyMask: false,
					// renderGcps: true,
					renderAppliableMask: true,
					renderTransformedGcps: true
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://gist.githubusercontent.com/sammeltassen/fa3dbfaf4dfa800e00824478c4bd1928/raw/79b2a1a9e864238c988278899555812dd90390f7/nl-railway-map-polynomial.json',
				caption: 'Spoorkaart van Nederland',
				options: {
					transformationType: 'polynomial',
					applyMask: true,
					renderTransformedGcps: true
				}
			}
		]
	},
	{
		freeze: true,
		annotations: [
			{
				url: 'https://gist.githubusercontent.com/sammeltassen/fa3dbfaf4dfa800e00824478c4bd1928/raw/79b2a1a9e864238c988278899555812dd90390f7/nl-railway-map-polynomial.json',
				caption: 'Spoorkaart van Nederland',
				options: {
					transformationType: 'polynomial',
					applyMask: true,
					renderGcps: true,
					renderTransformedGcps: true,
					renderVectors: true
				}
			}
		]
	},
	{
		freeze: true,
		annotations: [
			{
				url: 'https://gist.githubusercontent.com/sammeltassen/fa3dbfaf4dfa800e00824478c4bd1928/raw/79b2a1a9e864238c988278899555812dd90390f7/nl-railway-map-polynomial.json',
				caption: 'Spoorkaart van Nederland',
				options: {
					transformationType: 'thinPlateSpline',
					applyMask: true,
					renderGcps: true,
					renderTransformedGcps: true,
					renderVectors: true
				}
			}
		]
	},
	{
		freeze: true,
		annotations: [
			{
				url: 'https://gist.githubusercontent.com/sammeltassen/fa3dbfaf4dfa800e00824478c4bd1928/raw/79b2a1a9e864238c988278899555812dd90390f7/nl-railway-map-polynomial.json',
				caption: 'Spoorkaart van Nederland',
				options: {
					transformationType: 'thinPlateSpline',
					applyMask: true,
					removeColor: true,
					removeColorColor: '#fff3c8',
					removeColorThreshold: 0.1
				}
			}
		]
	},
	{
		freeze: true,
		annotations: [
			{
				url: 'https://gist.githubusercontent.com/sammeltassen/fa3dbfaf4dfa800e00824478c4bd1928/raw/79b2a1a9e864238c988278899555812dd90390f7/nl-railway-map-polynomial.json',
				caption: 'Spoorkaart van Nederland',
				options: {
					transformationType: 'thinPlateSpline',
					applyMask: true,
					removeColor: true,
					removeColorColor: '#fff3c8',
					removeColorThreshold: 0.1,
					colorize: true,
					colorizeColor: '#0000ff',
					saturation: 0
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://gist.githubusercontent.com/sammeltassen/fa3dbfaf4dfa800e00824478c4bd1928/raw/79b2a1a9e864238c988278899555812dd90390f7/nl-railway-map-polynomial.json',
				caption: 'Spoorkaart van Nederland',
				options: {
					transformationType: 'thinPlateSpline',
					applyMask: true,
					removeColor: true,
					removeColorColor: '#fff3c8',
					removeColorThreshold: 0.1,
					distortionMeasure: 'log2sigma'
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://gist.githubusercontent.com/sammeltassen/fa3dbfaf4dfa800e00824478c4bd1928/raw/79b2a1a9e864238c988278899555812dd90390f7/nl-railway-map-polynomial.json',
				caption: 'Spoorkaart van Nederland',
				options: {
					transformationType: 'thinPlateSpline',
					applyMask: true,
					removeColor: true,
					removeColorColor: '#fff3c8',
					removeColorThreshold: 0.1,
					distortionMeasure: 'twoOmega',
					renderGrid: true
				}
			}
		]
	}
] satisfies MapSlideProps[]
