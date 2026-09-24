import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snapMobilePanel } from '../src/lib/shared/mobile-panel.ts';

const heights = { collapsed: 90, half: 410, full: 820 };

test('small handle movements keep the existing panel position', () => {
  assert.equal(snapMobilePanel(heights, 'half', 395), 'half');
  assert.equal(snapMobilePanel(heights, 'half', 429), 'half');
});

test('deliberate upward and downward pulls move to the next position', () => {
  assert.equal(snapMobilePanel(heights, 'half', 470), 'full');
  assert.equal(snapMobilePanel(heights, 'half', 350), 'collapsed');
  assert.equal(snapMobilePanel(heights, 'full', 740), 'half');
  assert.equal(snapMobilePanel(heights, 'collapsed', 145), 'half');
});

test('a long pull can hide an expanded panel or fully expand a hidden one', () => {
  assert.equal(snapMobilePanel(heights, 'full', 120), 'collapsed');
  assert.equal(snapMobilePanel(heights, 'collapsed', 780), 'full');
});

test('quick flicks snap directionally and the end stops never overflow', () => {
  assert.equal(snapMobilePanel(heights, 'half', 430, 0.7), 'full');
  assert.equal(snapMobilePanel(heights, 'half', 390, -0.7), 'collapsed');
  assert.equal(snapMobilePanel(heights, 'full', 1000, 1), 'full');
  assert.equal(snapMobilePanel(heights, 'collapsed', -20, -1), 'collapsed');
});

test('card behind the navigator snaps through collapsed, half and full positions', () => {
  const card = { collapsed: 110, half: 422, full: 772 };
  assert.equal(snapMobilePanel(card, 'half', 155), 'collapsed');
  assert.equal(snapMobilePanel(card, 'collapsed', 390), 'half');
  assert.equal(snapMobilePanel(card, 'half', 750), 'full');
  assert.equal(snapMobilePanel(card, 'full', 480), 'half');
});
