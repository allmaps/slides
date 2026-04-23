import type { MapSlideProps } from '$lib/types'

const colors = {
	blue: '#4299BB',
	green: '#30C573',
	lapis: '#2B5CEA',
	pink: '#EF56BA',
	red: '#F2567A',
	slategray: '#93939F',
	tangerine: '#F19B6E',
	turquoise: '#00C3D4'
}

const slides: MapSlideProps[] = [
	{
		annotations: [
			{
				type: 'Image',
				url: 'https://digi.ub.uni-heidelberg.de/iiif/2/berain1703%3ATafel_05.jpg',
				caption: 'Jean Berain, Ornemens, Paris, ca. 1703',
				homepage: 'https://doi.org/10.11588/diglit.2045',
				region: [101, 361, 1941, 2767],
				wiggle: true
			}
		]
	},
	{
		annotations: [
			{
				type: 'Image',
				url: 'https://digi.ub.uni-heidelberg.de/iiif/2/berain1703%3ATafel_10.jpg',
				caption: 'Jean Berain, Ornemens, Paris, ca. 1703',
				homepage: 'https://doi.org/10.11588/diglit.2045',
				region: [123, 369, 1906, 2478],
				wiggle: true
			}
		]
	},
	{
		annotations: [
			{
				type: 'Image',
				url: 'https://iiif.micr.io/NKpnE',
				homepage: 'https://id.rijksmuseum.nl/200411334',
				caption: 'Ornament met architectuur met rocaille elementen en figuren',
				wiggle: true
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/ba0173f1dd5ddf4f@b6fa77a076461d7b',
				caption: 'Nuova Topografia Di Roma (1748)',
				homepage: 'https://www.davidrumsey.com/luna/servlet/s/bl033b',
				bearing: true
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/ba0173f1dd5ddf4f@b6fa77a076461d7b',
				caption: 'Nuova Topografia Di Roma (1748)',
				homepage: 'https://www.davidrumsey.com/luna/servlet/s/bl033b',
				bearing: true,
				options: {
					applyMask: false,
					transformationType: 'helmert'
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/520931210a661f8c@5f5e51a57632a1b7',
				caption: 'La topografia di Roma (1748)',
				homepage: 'https://www.davidrumsey.com/luna/servlet/s/ld70r7',
				bearing: true,
				options: {
					applyMask: false,
					transformationType: 'helmert'
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/520931210a661f8c@5f5e51a57632a1b7',
				caption: 'La topografia di Roma (1748)',
				homepage: 'https://www.davidrumsey.com/luna/servlet/s/ld70r7',
				bearing: true,
				options: {
					applyMask: false,
					transformationType: 'helmert',
					saturation: 0,
					removeColor: true,
					removeColorColor: '#e7dac1',
					removeColorThreshold: 0.3,
					colorize: true,
					colorizeColor: '#0000ff'
				}
			},
			{
				url: 'https://annotations.allmaps.org/maps/ba0173f1dd5ddf4f@b6fa77a076461d7b',
				caption: 'Nuova Topografia Di Roma (1748)',
				homepage: 'https://www.davidrumsey.com/luna/servlet/s/bl033b',
				bearing: true,
				options: {
					applyMask: false,
					saturation: 0,
					removeColor: true,
					removeColorColor: '#f1e0d3',
					removeColorThreshold: 0.3,
					colorize: true,
					colorizeColor: '#ff00ff'
				}
			}
		]
	},
	{
		hideBackground: false,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/520931210a661f8c@5f5e51a57632a1b7',
				caption: 'La topografia di Roma (1748)',
				homepage: 'https://www.davidrumsey.com/luna/servlet/s/ld70r7',
				bearing: true,
				options: {
					applyMask: true,
					transformationType: 'thinPlateSpline',
					saturation: 0,
					removeColor: true,
					removeColorColor: '#e7dac1',
					removeColorThreshold: 0.3,
					colorize: true,
					colorizeColor: '#0000ff'
				}
			},
			{
				url: 'https://annotations.allmaps.org/maps/ba0173f1dd5ddf4f@b6fa77a076461d7b',
				caption: 'Nuova Topografia Di Roma (1748)',
				homepage: 'https://www.davidrumsey.com/luna/servlet/s/bl033b',
				options: {
					applyMask: true,
					transformationType: 'thinPlateSpline',
					saturation: 0,
					removeColor: true,
					removeColorColor: '#f1e0d3',
					removeColorThreshold: 0.3,
					colorize: true,
					colorizeColor: '#ff00ff'
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/df1ac201a12a3f58@17e11a1a86f9b227',
				caption: "Pianta dell'antico Foro Romano (1784)",
				homepage:
					'https://libcatalog.ugent.be/nde/fulldisplay?context=U&vid=32RUG_INST:NDE&lang=nl&docid=alma990014930780409161&repId=12291066160009161',
				bearing: true
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/df1ac201a12a3f58@17e11a1a86f9b227',
				caption: "Pianta dell'antico Foro Romano (1784)",
				homepage:
					'https://libcatalog.ugent.be/nde/fulldisplay?context=U&vid=32RUG_INST:NDE&lang=nl&docid=alma990014930780409161&repId=12291066160009161',
				bearing: true,
				options: {
					applyMask: true,
					removeColor: true,
					removeColorColor: '#dac3b0',
					removeColorHardness: 1,
					removeColorThreshold: 0.3,
					saturation: 0,
					colorize: true,
					colorizeColor: '#000'
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/df1ac201a12a3f58@17e11a1a86f9b227',
				caption: "Pianta dell'antico Foro Romano (1784)",
				homepage:
					'https://libcatalog.ugent.be/nde/fulldisplay?context=U&vid=32RUG_INST:NDE&lang=nl&docid=alma990014930780409161&repId=12291066160009161',
				options: {
					applyMask: true,
					removeColor: true,
					removeColorColor: '#dac3b0',
					removeColorHardness: 1,
					removeColorThreshold: 0.3,
					saturation: 0,
					colorize: true,
					colorizeColor: '#ff0000'
				}
			},
			{
				url: 'https://annotations.allmaps.org/maps/53c3d5940a9a0366@137cc8eacb8118ba',
				caption: 'La pianta marmorea di Roma antica. Forma urbis Romae (Rome 1960), Plate 62',
				homepage: 'https://formaurbis.stanford.edu/plate.php?plateindex=61',
				bearing: true,
				options: {
					saturation: 0,
					removeColor: false,
					removeColorColor: '#ebebeb',
					removeColorThreshold: 0.3,
					removeColorHardness: 1,
					colorize: true,
					colorizeColor: '#0000ff'
				}
			}
		]
	},
	{
		location: {
			center: [12.492357382253356, 41.89024474655901],
			zoom: 17
		},
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/1d6d3d5dac04b8d6@047d2831df54f1fe',
				caption: 'La Pianta marmorea di Roma antica : forma urbis Romae. Plate 19',
				homepage: 'https://purl.stanford.edu/pb042tk5723',
				options: {
					removeColor: true,
					removeColorColor: '#e3e3e3',
					removeColorThreshold: 0.7
				}
			},
			{
				url: 'https://annotations.allmaps.org/maps/df1ac201a12a3f58@17e11a1a86f9b227',
				caption: "Pianta dell'antico Foro Romano (1784)",
				homepage:
					'https://libcatalog.ugent.be/nde/fulldisplay?context=U&vid=32RUG_INST:NDE&lang=nl&docid=alma990014930780409161&repId=12291066160009161',
				options: {
					applyMask: true,
					removeColor: true,
					removeColorColor: '#dac3b0',
					removeColorHardness: 1,
					removeColorThreshold: 0.3,
					saturation: 0,
					colorize: true,
					colorizeColor: '#ff0000'
				}
			},
			{
				url: 'https://annotations.allmaps.org/maps/53c3d5940a9a0366@137cc8eacb8118ba',
				caption: 'La pianta marmorea di Roma antica. Forma urbis Romae (Rome 1960), Plate 62',
				homepage: 'https://formaurbis.stanford.edu/plate.php?plateindex=61',
				bearing: true,
				options: {
					saturation: 0,
					removeColor: false,
					removeColorColor: '#ebebeb',
					removeColorThreshold: 0.3,
					removeColorHardness: 1,
					colorize: true,
					colorizeColor: '#0000ff'
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/df1ac201a12a3f58@17e11a1a86f9b227',
				caption: "Pianta dell'antico Foro Romano (1784)",
				homepage:
					'https://libcatalog.ugent.be/nde/fulldisplay?context=U&vid=32RUG_INST:NDE&lang=nl&docid=alma990014930780409161&repId=12291066160009161',
				bearing: true,
				options: {
					applyMask: false,
					transformationType: 'helmert'
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/ff552d5b04c8ad64@44a5ca489e7aebe8',
				caption: 'Forma Urbis Romae (1901)',
				homepage: 'https://www.davidrumsey.com/luna/servlet/s/61414w',
				bearing: true,
				options: {
					applyMask: true,
					removeColor: false,
					removeColorColor: '#fefeef',
					removeColorThreshold: 0.3
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/435ccc0ea633df34@3d263d75a9563b6a',
				caption: 'Amstelredamum emporium Hollandiæ primarium totiusque Europæ celeberrimum',
				homepage: 'https://hdl.handle.net/11245/3.39844',
				bearing: true
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/20d9ec9585559c75@cacecc4f8c8a1747',
				caption: 'Lijnen der Amsterdamsche Tram Omnibus-Maatschappij',
				homepage: 'https://archief.amsterdam/beeldbank/detail/481a8a57-49b2-81f5-0e1d-bcc67a745d62',
				bearing: true,
				options: {
					applyMask: true
				}
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/20d9ec9585559c75@cacecc4f8c8a1747',
				caption: 'Lijnen der Amsterdamsche Tram Omnibus-Maatschappij',
				homepage: 'https://archief.amsterdam/beeldbank/detail/481a8a57-49b2-81f5-0e1d-bcc67a745d62',
				bearing: true,
				options: {
					applyMask: false
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/bbb5d884229b5d58@ee6c33a1a2930f2d',
				caption: 'Het Huis ter Nieuburch in Rijswijk, plaats van de vredesonderhandelingen in 1697',
				homepage: 'https://id.rijksmuseum.nl/200512128',
				bearing: true
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				url: 'https://annotations.allmaps.org/maps/bbb5d884229b5d58@ee6c33a1a2930f2d',
				caption: 'Het Huis ter Nieuburch in Rijswijk, plaats van de vredesonderhandelingen in 1697',
				homepage: 'https://id.rijksmuseum.nl/200512128',
				bearing: true,
				options: {
					applyMask: false
				}
			}
		]
	},
	{
		annotations: [
			{
				caption: 'Kaart van de aanleg van de straatweg van Den Haag naar Scheveningen, 1664-1665',
				url: 'https://annotations.allmaps.org/maps/dcebedaf49942412@bac7a903774f5cb9',
				homepage: 'https://id.rijksmuseum.nl/200441164',
				bearing: true
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				caption: 'Kaart van de aanleg van de straatweg van Den Haag naar Scheveningen, 1664-1665',
				url: 'https://annotations.allmaps.org/maps/dcebedaf49942412@bac7a903774f5cb9',
				homepage: 'https://id.rijksmuseum.nl/200441164',
				bearing: true,
				options: {
					applyMask: false
				}
			}
		]
	},
	{
		annotations: [
			{
				bearing: true,
				caption: "'t Hooge Heemraedschap van Delflant",
				url: 'https://annotations.allmaps.org/maps/b20bb58574835ae5@3cb1992f8fb3aa45',
				homepage: 'https://heritage.tudelft.nl/nl/objects/d019e4bd-ade1-4bef-90cd-df9517ac2837'
			}
		]
	},
	{
		hideBackground: true,
		annotations: [
			{
				bearing: true,
				caption: "'t Hooge Heemraedschap van Delflant",
				url: 'https://annotations.allmaps.org/maps/b20bb58574835ae5@3cb1992f8fb3aa45',
				homepage: 'https://heritage.tudelft.nl/nl/objects/d019e4bd-ade1-4bef-90cd-df9517ac2837',
				options: {
					applyMask: false
				}
			}
		]
	},
	{
		annotations: [
			{
				bearing: true,
				caption: "'t Hooge Heemraedschap van Delflant",
				url: 'https://annotations.allmaps.org/maps/432c3766cb25d426@8d21e594a87413ea',
				homepage: 'https://heritage.tudelft.nl/nl/objects/d019e4bd-ade1-4bef-90cd-df9517ac2837',
				options: {
					applyMask: false
				}
			}
		]
	},
	{
		annotations: [
			{
				url: 'https://raw.githubusercontent.com/bmmeijers/iiif-annotations/main/series/kraijenhoff/uu/latest.json',
				caption:
					'Choro-topographische kaart der Noordelijke Provincien van het Koningrijk der Nederlanden KAART: Moll 78 (Dk50-7) (1816)',
				homepage: 'https://objects.library.uu.nl/reader/index.php?obj=1874-300222'
			}
		]
	}
]

export default slides
