import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { WarpedMapList, WarpedMapEventType } from '@allmaps/render';
import { WebGL2WarpedMap } from '@allmaps/render/webgl2';
import { setComparisonOpacity } from '../src/lib/shared/map/comparison.ts';

const fixture = JSON.parse(readFileSync(new URL('../../../packages/slides/tests/fixtures/projective-map.json', import.meta.url)));

test('comparison redraws an idle map even when Allmaps omits the opacity change event', () => {
  // Exercise the installed renderer's actual option merging/event dispatch.
  // No GPU is needed to test it; only WebGL object allocation is stubbed.
  const gl = { createVertexArray: () => ({}), createTexture: () => ({}) };
  const list = new WarpedMapList({ createRTree: false,
    warpedMapFactory: (id, map, listOptions, mapOptions) =>
      new WebGL2WarpedMap(id, map, gl, {}, {}, {}, listOptions, mapOptions),
  });
  const id = list.addGeoreferencedMap(fixture, { opacity: 0.7, visible: true });
  let paintedOpacity = 0.7;
  const map = { triggerRepaint() { paintedOpacity = list.getWarpedMap(id).options.opacity; } };
  list.addEventListener(WarpedMapEventType.IMMEDIATECHANGE, () => map.triggerRepaint());
  const layer = { setLayerOptions: (...args) => list.setListOptions(...args) };

  for (const opacity of [0.7, 1, 0.3]) {
    list.setMapsOptions(() => ({ opacity }), { animate: false });
    // Model the last frame drawn as zooming finishes and MapLibre becomes idle.
    map.triggerRepaint();
    for (let repeat = 0; repeat < 2; repeat++) {
      setComparisonOpacity(map, layer, true);
      assert.equal(paintedOpacity, 0, `hide authored opacity ${opacity}`);
      assert.equal(list.getWarpedMap(id).mapOptions.opacity, opacity);
      assert.equal(list.getWarpedMap(id).options.visible, true);
      setComparisonOpacity(map, layer, false);
      assert.equal(paintedOpacity, opacity, 'release restores authored opacity');
    }
  }
});
