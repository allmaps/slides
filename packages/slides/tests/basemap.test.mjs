import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEffectiveBasemapStyleConfig, resolveBasemapStyle } from '../src/model/basemap.ts';

test('no style or Protomaps key means no basemap resources in either theme', async () => {
  for (const theme of ['light', 'dark']) {
    for (const appProtomaps of [undefined, {}, { key: '' }, { key: '  ' }, { flavor: 'light' }]) {
      const config = getEffectiveBasemapStyleConfig({ theme, appProtomaps });
      const style = await resolveBasemapStyle({ theme, config,
        fetchFn: () => assert.fail('An unconfigured basemap must not fetch resources'),
      });
      assert.deepEqual(style.sources, {});
      assert.deepEqual(style.layerIds, []);
      assert.equal(style.glyphs, undefined);
      assert.equal(style.sprite, undefined);
    }
  }
});

test('explicit Protomaps keys still enable the generated basemap and inherit per slide', async () => {
  for (const theme of ['light', 'dark']) {
    const config = getEffectiveBasemapStyleConfig({ theme,
      appProtomaps: { key: 'project-key' },
      chapterMap: { protomaps: { key: 'slide-key' } },
    });
    const style = await resolveBasemapStyle({ theme, config });
    assert.equal(style.sources['basemap:protomaps'].url, 'https://api.protomaps.com/tiles/v4.json?key=slide-key');
    assert.ok(style.baseLayers.length > 0);
    assert.ok(style.labelLayers.length > 0);
    assert.ok(style.glyphs);
    assert.ok(style.sprite);
  }
});

test('custom styles work without a key and take precedence over Protomaps', async () => {
  const custom = { version: 8, sources: {}, layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#123456' } },
  ] };
  for (const key of [undefined, 'project-key']) {
    const config = getEffectiveBasemapStyleConfig({ theme: 'light',
      appProtomaps: { key }, appMap: { styles: { light: custom } },
    });
    const style = await resolveBasemapStyle({ theme: 'light', config });
    assert.deepEqual(style.sources, {});
    assert.deepEqual(style.layerIds, ['basemap:background']);
    assert.equal(style.foregroundColor, '#123456');
  }
  const darkConfig = getEffectiveBasemapStyleConfig({ theme: 'dark', appMap: { styles: { light: custom } } });
  assert.deepEqual((await resolveBasemapStyle({ theme: 'dark', config: darkConfig })).layerIds, []);
});
