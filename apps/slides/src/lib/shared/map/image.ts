import { getCoords, rhumbDestination, point } from "@turf/turf";
import type { GeoreferencedMap } from "@allmaps/annotation";
type Coord = [number, number];
type FauxGcp = { resource: Coord; geo: Coord };

export const createFauxGeoreferencedMap = async (
  imageId: string,
  options: {
    bounds?: [number, number, number, number];
    region?: [number, number, number, number];
    center?: [number, number];
    bearing?: number;
    wiggle?: boolean;
    fetchFn?: typeof fetch;
  },
) => {
  let { region, bounds, center } = options;
  // if (!bounds) {
  // 	bounds = [-0.1, -0.1, 0.1, 0.1]
  // }
  if (!center) {
    center = [0, 0];
  }
  const imageInfo = (await (options.fetchFn ?? fetch)(
    `${imageId}/info.json`,
  ).then((response) => {
    if (!response.ok) throw new Error(`Image metadata: ${response.status}`);
    return response.json();
  })) as {
    width: number;
    height: number;
  };
  const { width, height } = imageInfo;
  let gcps: FauxGcp[];
  let [resourceX, resourceY, resourceWidth, resourceHeight] = [
    0,
    0,
    width,
    height,
  ];
  if (region) {
    [resourceX, resourceY, resourceWidth, resourceHeight] = region;
  }
  const resourceMask: Coord[] = [
    [resourceX, resourceY],
    [resourceX + resourceWidth, resourceY],
    [resourceX + resourceWidth, resourceY + resourceHeight],
    [resourceX, resourceY + resourceHeight],
  ];
  if (bounds) {
    const [xMin, yMin, xMax, yMax] = bounds;
    gcps = [
      {
        resource: [resourceX, resourceY + resourceHeight],
        geo: [xMin, yMin],
      },
      {
        resource: [resourceX + resourceWidth, resourceY],
        geo: [xMax, yMax],
      },
    ];
  } else {
    const landscape = resourceWidth > resourceHeight;
    let bearing = landscape ? -90 : 0;
    if (options.wiggle) {
      bearing += 2.5;
    }
    const centerX = Math.round(resourceX + resourceWidth / 2);
    const centerY = Math.round(resourceY + resourceHeight / 2);
    gcps = [
      {
        resource: [centerX, centerY],
        geo: center,
      },
      {
        resource: landscape ? [resourceX, centerY] : [centerX, resourceY],
        geo: getCoords(rhumbDestination(point(center), 100, bearing)) as Coord,
      },
    ];
  }
  return {
    ["@context"]: "https://schemas.allmaps.org/map/2/context.json",
    id: imageId,
    type: "GeoreferencedMap",
    resource: {
      id: imageId,
      width,
      height,
      type: "ImageService3",
    },
    gcps,
    resourceMask,
    transformation: {
      type: "helmert",
    },
  } satisfies GeoreferencedMap;
};
