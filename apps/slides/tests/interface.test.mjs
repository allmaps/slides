import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInterfaceText } from '../src/lib/shared/interface-settings.ts';
import { slideshowShortcut } from '../src/lib/shared/keyboard.ts';

test('interface overrides interpolate repeated placeholders and preserve missing defaults', () => {
  const t = createInterfaceText(() => ({ text: { chapterPosition: '{current} van {total} ({current})' } }));
  assert.equal(t('chapterPosition', { current: 3, total: 6 }), '3 van 6 (3)');
  assert.equal(t('close'), 'Close');
  assert.equal(t('backToTitle', { title: '<My story>' }), 'Back to <My story>');
});

test('legacy start screen labels remain supported and new text overrides take precedence', () => {
  const t = createInterfaceText(() => ({ startScreen: { startButton: 'Begin' }, text: { startButton: 'Start here' } }));
  assert.equal(t('startButton'), 'Start here');
  assert.equal(createInterfaceText(() => ({ startScreen: { madeWith: 'Gemaakt met' } }))('madeWith'), 'Gemaakt met');
});

test('slideshow shortcuts leave typing, modified browser shortcuts, and consumed keys alone', () => {
  assert.equal(slideshowShortcut({ key: 'ArrowRight' }), 'next');
  assert.equal(slideshowShortcut({ key: 'ArrowLeft' }), 'previous');
  assert.equal(slideshowShortcut({ key: 'b' }), 'back');
  assert.equal(slideshowShortcut({ key: 'h' }), 'togglePanel');
  for (const option of ['blocked', 'defaultPrevented', 'ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'isComposing']) {
    assert.equal(slideshowShortcut({ key: 'ArrowLeft', [option]: true }), undefined, option);
  }
  assert.equal(slideshowShortcut({ key: 'Tab' }), undefined);
});

test('Space starts a temporary map comparison and replaces backtick', () => {
  assert.equal(slideshowShortcut({ key: ' ' }), 'hideMaps');
  assert.equal(slideshowShortcut({ key: '`' }), undefined);
  for (const option of ['blocked', 'defaultPrevented', 'ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'isComposing', 'repeat']) {
    assert.equal(slideshowShortcut({ key: ' ', [option]: true }), undefined, option);
  }
  // Repeated navigation keys still advance chapters.
  assert.equal(slideshowShortcut({ key: 'ArrowRight', repeat: true }), 'next');
});

// Model the selectors matched by a focused element or one of its ancestors.
function targetMatching(...matches) {
  return { closest(selectors) {
    return selectors.split(',').some(selector => matches.includes(selector.trim())) ? this : null;
  } };
}

test('map canvas and chapter-link focus keep all slideshow shortcuts available', () => {
  for (const target of [targetMatching('.maplibregl-canvas'), targetMatching('a[href]'), targetMatching('[role="link"]')]) {
    for (const [key, action] of [['ArrowRight', 'next'], ['ArrowLeft', 'previous'], ['b', 'back'], ['h', 'togglePanel'], [' ', 'hideMaps']]) {
      assert.equal(slideshowShortcut({ key, target }), action, key);
    }
  }
});

test('Space still activates focused controls, including icons inside buttons', () => {
  for (const selector of ['button', 'summary', '[role="button"]', '[role="checkbox"]', '[role="switch"]']) {
    const target = targetMatching(selector);
    assert.equal(slideshowShortcut({ key: ' ', target }), undefined, selector);
    assert.equal(slideshowShortcut({ key: 'h', target }), 'togglePanel', selector);
    assert.equal(slideshowShortcut({ key: 'ArrowRight', target }), 'next', selector);
  }
  const slider = targetMatching('[role="slider"]');
  assert.equal(slideshowShortcut({ key: 'ArrowRight', target: slider }), undefined);
  assert.equal(slideshowShortcut({ key: ' ', target: slider }), undefined);
  assert.equal(slideshowShortcut({ key: 'h', target: slider }), 'togglePanel');
});

test('typing and modal dialogs retain their keyboard controls, including Escape', () => {
  for (const selector of ['input', 'textarea', 'select', '[contenteditable]:not([contenteditable="false"])', '[role="textbox"]', '[role="combobox"]']) {
    for (const key of ['ArrowRight', 'ArrowLeft', 'b', 'h', ' ']) {
      assert.equal(slideshowShortcut({ key, target: targetMatching(selector) }), undefined, `${selector}: ${key}`);
    }
  }
  assert.equal(slideshowShortcut({ key: 'Escape' }), 'closePanel');
  for (const key of ['Escape', 'ArrowRight', 'h', ' ']) {
    assert.equal(slideshowShortcut({ key, blocked: true }), undefined, key);
    assert.equal(slideshowShortcut({ key, defaultPrevented: true }), undefined, key);
  }
});
