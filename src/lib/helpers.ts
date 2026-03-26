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

type BBox = [number, number, number, number]
type Coord = [number, number]

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
