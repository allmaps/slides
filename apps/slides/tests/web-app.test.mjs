import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWebAppManifest } from '../src/lib/shared/web-app.ts';

const project = {
  title: 'Project name', description: 'An atlas', main: 'main',
  slideshows: [{ id: 'main', title: 'Main story' }, { id: 'history', title: 'History' }],
};

test('installation always launches the main story and includes every slideshow route', () => {
  for (const base of ['', '/atlas', '/stories/atlas']) {
    const root = `${base}/`;
    const icon = `${base}/_app/immutable/assets/icon.png`;
    const manifest = createWebAppManifest(project, base, icon);
    assert.equal(manifest.name, 'Main story');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, root);
    assert.equal(manifest.id, root);
    assert.equal(manifest.scope, root);
    assert.deepEqual(manifest.icons, [{ src: icon, sizes: '180x180', type: 'image/png', purpose: 'any' }]);
    for (const route of ['', 'history', 'history#chapter-2']) {
      assert.ok(`${root}${route}`.startsWith(manifest.scope));
    }
    assert.ok(!`${base}-other/history`.startsWith(manifest.scope));
  }
});

test('installation metadata falls back to the project title', () => {
  assert.equal(createWebAppManifest({ ...project, slideshows: [] }, '', '/icon.png').name, 'Project name');
});
