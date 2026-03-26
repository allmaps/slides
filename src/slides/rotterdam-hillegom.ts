import type { MapSlideProps } from '$lib/types'

const slides: MapSlideProps[] = [
	{
		annotations: [
			{
				url: 'https://sammeltassen.nl/iiif-manifests/allmaps/rotterdam-1897.json',
				bearing: true
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/30b43175342a28b6@2e6470a8d174949f',
				caption: 'Nieuwe plattegrond der stad Rotterdam (1865)',
				bearing: true,
				options: {
					transformationType: 'helmert'
				}
			}
		]
	},
	{
		// location: {
		// 	center: [4.466506, 51.927387],
		// 	zoom: 12
		// },
		annotations: [
			// {
			// 	url: 'https://raw.githubusercontent.com/bmmeijers/iiif-annotations/main/series/kraijenhoff/uu/latest.json',
			// 	// url: 'https://raw.githubusercontent.com/bmmeijers/iiif-annotations/main/series/kraijenhoff/dlcs/latest.json',
			// 	caption: 'Kraijenhoff'
			// },
			{
				url: 'https://annotations.allmaps.org/maps/43a6b587668f23b4@c6eb295daf1d859b',
				caption: 'Het Hooge Heemraedt schap van Schielandt',
				bearing: true,
				options: {
					removeColor: true,
					removeColorColor: '#FFF',
					removeColorThreshold: 0.5
				}
			}
		],
		geojsons: [
			{
				url: '/geojson/fietstocht.geojson'
			}
		]
	},
	{
		// location: {
		// 	center: [4.5530893, 51.976715],
		// 	zoom: 12
		// },
		annotations: [
			// { url: 'https://annotations.allmaps.org/maps/173f41903b3a143d', caption: 'Rottemeren' }
			{
				url: 'https://annotations.allmaps.org/maps/2665fd8c8cc1b11c@aea372868edc6f22',
				caption: "'t Ambacht van Hillegersberg",
				bearing: true
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/d49fc22647a499d7@0e87da4ff7464a5f',
				caption:
					'Kaarte van de uytgeveende en naderhand drooggemaakte landen onder Haserswoude, Hoogeveen, Noordwaddingsveen, Benthorn, Benthuysen en Soeterwoude of wel Gelderswoude',
				bearing: true
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/6a74aa1b0a1cd30f@6eed53e93a15ae63',
				caption: 'Nieuwe kaart der stad Leyden',
				bearing: true
			}
		]
	},
	{
		location: {
			bearing: 90
		},
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/8d600f869d79b7db',
				caption: 'Stratenboek',
				options: {
					transformationType: 'helmert'
				},
				bearing: true
			}
		]
	},
	{
		location: {
			bearing: 90
		},
		// freeze: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/8d600f869d79b7db',
				caption: 'Stratenboek',
				bearing: true,
				options: {
					transformationType: 'thinPlateSpline'
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/82172b1fdbcd8c40@e8a555b5056c4886',
				caption:
					'Ioannes Dou, Chaertbouck van alle de Landen der Unyversiteyt binnen de Stadt Leyden [etc.]',
				bearing: true
			}
		]
	},
	{
		// location: {
		// 	center: [4.569164, 52.3022714],
		// 	zoom: 12
		// },
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/85910a5bab900c3f@0c6e85b88adfb471',
				caption: 'Jan Jansz Dou en Steven van Broeckhuysen, Rijnland (1746)',
				bearing: true,
				options: {
					// transformationType: 'helmert',
					// saturation: 1,
					removeColor: false,
					colorize: false,
					saturation: 1
				}
			}
		]
	},
	{
		location: {
			center: [4.7621975, 52.3080392],
			zoom: 12
		},
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/85910a5bab900c3f@0c6e85b88adfb471',
				caption: 'Jan Jansz Dou en Steven van Broeckhuysen, Rijnland (1746)',
				options: {
					removeColor: true,
					removeColorColor: '#D3D3D3',
					removeColorThreshold: 0.7,
					removeColorHardness: 0.2,
					saturation: 0
					// colorize: true
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/95daa06fe824bda6',
				options: {
					removeColor: true,
					removeColorColor: '#DFDBC8',
					removeColorThreshold: 0.2
				}
			}
		]
	}
]

export default slides
