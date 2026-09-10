import assert from 'node:assert/strict';
import { render } from 'svelte/server';
import App from './App.svelte';

globalThis.fetch = () => { throw new Error('SSR must not fetch IIIF'); };
const { body } = render(App);
assert.match(body, /<figure\b/);
assert.match(body, /<figcaption\b/);
assert.match(body, /<em>rich caption<\/em>/);
assert.match(body, /href="https:\/\/example.org\/object"/);
assert.match(body, /Loading image/);
assert.doesNotMatch(body, /<img\b|<canvas\b|srcset=/);
console.log('Packed component SSR: caption present, no browser runtime or fetch.');
