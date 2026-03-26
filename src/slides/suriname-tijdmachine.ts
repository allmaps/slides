import type { MapSlideProps } from '$lib/types'

const slides: MapSlideProps[] = [
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/2c26d7d97e3f2afe',
				bearing: true,
				options: {
					transformationType: 'helmert',
					applyMask: false,
					renderAppliableMask: false,
					renderGcps: false
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/2c26d7d97e3f2afe',
				bearing: true,
				options: {
					transformationType: 'helmert',
					applyMask: false,
					renderAppliableMask: true,
					renderGcps: false
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/2c26d7d97e3f2afe',
				bearing: true,
				options: {
					transformationType: 'helmert',
					applyMask: false,
					renderAppliableMask: true,
					renderGcps: true
				}
			}
		]
	},
	{
		freeze: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/2c26d7d97e3f2afe',
				// bearing: true,
				options: {
					transformationType: 'helmert',
					applyMask: true,
					renderAppliableMask: true,
					renderGcps: true
				}
			}
		]
	},
	{
		freeze: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/2c26d7d97e3f2afe',
				options: {
					transformationType: 'thinPlateSpline',
					applyMask: true,
					renderAppliableMask: false,
					renderGcps: false
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/2c26d7d97e3f2afe',
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
		location: {
			duration: 0
		},
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/0f08ca87090bda4f',
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
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/0f08ca87090bda4f',
				options: {
					transformationType: 'thinPlateSpline',
					applyMask: true
				},
				bearing: true
			}
		]
	},
	{
		annotations: [
			{
				url: '/annotations/kaart-van-suriname-1930.json',
				caption: 'Kaart van Suriname (1930)'
			}
		]
	}
	// {
	// 	annotations: [
	// 		{
	// 			url: 'https://annotations.allmaps.org/manifests/5178b46e14dc211e',
	// 			caption: 'Kaart van Suriname (1930)'
	// 		}
	// 	]
	// }
]

export default slides
