import assert from 'node:assert/strict';
import { test } from 'node:test';
import maplibregl from 'maplibre-gl';
import { constrainSlideshowCamera } from '../src/lib/shared/map/constraints.ts';

test('an overview offset above the mobile panel can extend beyond the world', () => {
  const zoom = 0.62;
  const worldSize = 512 * 2 ** zoom;
  const viewportHeight = 762;
  const overview = maplibregl.MercatorCoordinate.fromLngLat([22.38, 7.96]);
  // Leave 160px beneath the chart's center for the text panel.
  const requestedCenter = new maplibregl.MercatorCoordinate(
    overview.x,
    overview.y + 160 / worldSize,
  ).toLngLat();
  const result = constrainSlideshowCamera(requestedCenter, zoom);
  const renderedCenter = maplibregl.MercatorCoordinate.fromLngLat(result.center);

  assert.ok(renderedCenter.y * worldSize + viewportHeight / 2 > worldSize);
  assert.deepEqual(result.center.toArray(), requestedCenter.toArray());
  assert.equal(result.zoom, zoom);
  assert.ok(Math.abs((overview.y - renderedCenter.y) * worldSize + 160) < 1e-10);
});

test('overpanning keeps polar centers projectable and retains zoom limits', () => {
  for (const latitude of [-90, 90]) {
    const result = constrainSlideshowCamera(new maplibregl.LngLat(360, latitude), 1);
    const projected = maplibregl.MercatorCoordinate.fromLngLat(result.center);
    assert.ok(Number.isFinite(projected.y));
    assert.ok(Math.abs(result.center.lat) < 90);
    assert.equal(result.center.lng, 360);
  }
  const center = new maplibregl.LngLat(0, 0);
  assert.equal(constrainSlideshowCamera(center, -1).zoom, -1);
  assert.equal(constrainSlideshowCamera(center, -3).zoom, -2);
  assert.equal(constrainSlideshowCamera(center, 30).zoom, 22);
});
