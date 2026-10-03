import type { AllPaintProperties, LayerSpecification, Map as MapLibreMap, TransitionSpecification } from 'maplibre-gl';
import { LAYER_TYPES } from '../settings.ts';

const TRANSITION = { duration: 300, delay: 0 };
const IMMEDIATE = { duration: 0, delay: 0 };

type LayerState = { visible: boolean; cancelHide?: () => void };

/** Let MapLibre animate opacity; only defer visibility:none until the fade ends. */
export function createLayerTransitions(
  map: Pick<MapLibreMap, 'setPaintProperty' | 'setLayoutProperty' | 'getLayer' | 'on' | 'off'>,
) {
  const states = new Map<string, LayerState>();

  return {
    set(layer: LayerSpecification, visible: boolean, immediate = false) {
      const previous = states.get(layer.id);
      const wasRenderable = previous?.visible || !!previous?.cancelHide;
      previous?.cancelHide?.();
      const state: LayerState = { visible };
      states.set(layer.id, state);
      const animate = !!previous && !immediate;
      const paint = layer.paint as Partial<AllPaintProperties> | undefined;
      const opacityProperties = LAYER_TYPES[layer.type as keyof typeof LAYER_TYPES] ?? [];
      // Whole-layer opacity preserves feature-dependent line/fill styling.
      // Circle/symbol opacity uses native transitions with their usual limits.
      const fadeProperties = layer.type === 'line' || layer.type === 'fill'
        ? [`${layer.type}-layer-opacity`] : opacityProperties;
      let hideAfter = 0;

      for (const property of new Set([...opacityProperties, ...fadeProperties])) {
        const opacity = property as keyof AllPaintProperties;
        const transition = `${property}-transition` as keyof AllPaintProperties;
        const fades = fadeProperties.includes(property);
        const timing = animate
          ? { ...TRANSITION, ...paint?.[transition] as TransitionSpecification | undefined }
          : IMMEDIATE;
        map.setPaintProperty(layer.id, transition, timing);
        map.setPaintProperty(layer.id, opacity, fades && !visible ? 0 : paint?.[opacity]);
        if (fades) hideAfter = Math.max(hideAfter, timing.duration + timing.delay);
      }

      if (visible || !wasRenderable || !hideAfter) {
        map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
        return;
      }

      // Start the visibility timer after MapLibre has applied the paint update.
      // Cancelling it on the next slide prevents an old fade from hiding a layer.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const rendered = () => {
        map.off('render', rendered);
        timer = setTimeout(() => {
          state.cancelHide = undefined;
          if (map.getLayer(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
        }, hideAfter);
      };
      state.cancelHide = () => {
        map.off('render', rendered);
        clearTimeout(timer);
      };
      map.on('render', rendered);
    },
    destroy() {
      for (const state of states.values()) state.cancelHide?.();
      states.clear();
    },
  };
}
