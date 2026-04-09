import {
	bbox,
	transformRotate,
	multiPolygon,
	bboxPolygon,
	center,
	getCoords,
	distance,
	lineString
} from '@turf/turf'
import {
	geometryToGeojsonGeometry,
	geojsonGeometryToGeojsonFeature,
	geojsonFeaturesToGeojsonFeatureCollection,
	rotatePoints,
	computeBbox,
	bboxToCenter
} from '@allmaps/stdlib'
import maplibregl from 'maplibre-gl'
import type { GeoreferencedMap } from '@allmaps/annotation'

type BBox = [number, number, number, number]
type Coord = [number, number]

export const fetchJson = (url: string) => fetch(url).then((resp) => resp.json())

// Need to take into account display ratio!
export const getNarrowBbox = (mapsBbox: BBox) => {
	const [xCenter, yCenter] = getCoords(center(bboxPolygon(mapsBbox))) as Coord
	const [xMin, yMin, xMax, yMax] = mapsBbox
	const distanceX = distance([xMin, yMin], [xMax, yMin])
	const distanceY = distance([xMin, yMin], [xMin, yMax])
	if (distanceX < distanceY) {
		const line = lineString([
			[xMin, yCenter],
			[xMax, yCenter]
		])
		return bbox(line) as BBox
		// return [xCenter, yMin, xCenter, yMax]
	} else {
		const line = lineString([
			[xCenter, yMin],
			[xCenter, yMax]
		])
		return bbox(line) as BBox
		// return [xMin, yCenter, xMax, yCenter]
	}
}

export const getAxisAlignedBboxAndCenter = (geoMasks, bearing: number) => {
	// Use first mask coordinate as pivot
	const pivot: Coord = geoMasks[0][0]

	// Create a MultiPolygon from the masks
	const polygons = geoMasks.map((geoMask) => [geoMask.concat([geoMask[0]])])
	const multiPolygonFeature = multiPolygon(polygons)

	// Rotate this polygon, calculate bbox and center
	const rotatedPolygon = transformRotate(multiPolygonFeature, bearing, { pivot })
	const rotatedBbox = bbox(rotatedPolygon) as BBox
	const rotatedCenter = center(bboxPolygon(rotatedBbox))

	// Rotate back the center
	const viewportCenter = transformRotate(rotatedCenter, -bearing, { pivot })
	const viewportCenterCoord = getCoords(viewportCenter) as Coord

	// Return bbox and center coords
	return {
		bounds: rotatedBbox,
		center: new maplibregl.LngLat(...viewportCenterCoord)
	}
}

export const createFauxGeoreferencedMap = async (
	imageId: string,
	options: {
		bounds?: [number, number, number, number]
		region?: [number, number, number, number]
	}
) => {
	let { region, bounds } = options
	if (!bounds) {
		bounds = [-0.1, -0.1, 0.1, 0.1]
	}
	const imageInfo = await fetchJson(`${imageId}/info.json`)
	const { width, height } = imageInfo
	let [xMin, yMin, xMax, yMax] = bounds
	let [resourceX, resourceY, resourceWidth, resourceHeight] = [0, 0, width, height]
	if (region) {
		;[resourceX, resourceY, resourceWidth, resourceHeight] = region
	}
	const resourceMask = [
		[resourceX, resourceY],
		[resourceX + resourceWidth, resourceY],
		[resourceX + resourceWidth, resourceY + resourceHeight],
		[resourceX, resourceY + resourceHeight]
	]
	const gcps = [
		{
			resource: [resourceX, resourceY + resourceHeight],
			geo: [xMin, yMin]
		},
		{
			resource: [resourceX + resourceWidth, resourceY],
			geo: [xMax, yMax]
		}
	]
	return {
		['@context']: 'https://schemas.allmaps.org/map/2/context.json',
		id: imageId,
		type: 'GeoreferencedMap',
		resource: {
			id: imageId,
			width,
			height,
			type: 'ImageService3'
		},
		gcps,
		resourceMask,
		transformation: {
			type: 'straight'
		}
	} satisfies GeoreferencedMap
}
