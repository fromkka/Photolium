import assert from 'node:assert/strict';
import test from 'node:test';

import { parseEmotionMessage } from '../emotion-parser.js';

const images = [{ name: 'neutral.png' }, { name: 'happy.png' }, { name: 'angry.png' }];

test('changes portraits more than once in one response', () => {
    const source = '[happy.png]\nHello there.\n\n[angry.png]\nThat is enough.';
    assert.deepEqual(parseEmotionMessage(source, images, 'neutral.png'), [
        { emotion: 'happy.png', text: 'Hello there.' },
        { emotion: 'angry.png', text: 'That is enough.' },
    ]);
});

test('inherits the current portrait for untagged paragraphs', () => {
    const source = '[happy.png]\nFirst paragraph.\n\nSecond paragraph.';
    assert.deepEqual(parseEmotionMessage(source, images, 'neutral.png'), [
        { emotion: 'happy.png', text: 'First paragraph.' },
        { emotion: 'happy.png', text: 'Second paragraph.' },
    ]);
});

test('ignores invented filenames and keeps the configured default', () => {
    const source = '[invented.png]\nNo matching image.';
    assert.deepEqual(parseEmotionMessage(source, images, 'neutral.png'), [
        { emotion: 'neutral.png', text: 'No matching image.' },
    ]);
});

test('works without emotion images for avatar fallback mode', () => {
    assert.deepEqual(parseEmotionMessage('Plain response.', [], null), [
        { emotion: null, text: 'Plain response.' },
    ]);
});

