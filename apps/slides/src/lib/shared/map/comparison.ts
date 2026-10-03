import type { WarpedMapLayer } from '@allmaps/maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';

export function setComparisonOpacity(
  map: Pick<MapLibreMap, 'triggerRepaint'>,
  layer: Pick<WarpedMapLayer, 'setLayerOptions'>,
  hidden: boolean,
) {
  // Keep each map's authored opacity and visibility intact.
  layer.setLayerOptions({ opacity: hidden ? 0 : 1 }, { animate: false });
  // Allmaps can omit its change event when layer opacity is multiplied by a
  // map-specific opacity. A settled MapLibre map then retains its old frame.
  map.triggerRepaint();
}
