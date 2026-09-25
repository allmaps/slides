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
  for (const option of ['blocked', 'defaultPrevented', 'ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
    assert.equal(slideshowShortcut({ key: 'ArrowLeft', [option]: true }), undefined, option);
  }
  assert.equal(slideshowShortcut({ key: 'Tab' }), undefined);
});
