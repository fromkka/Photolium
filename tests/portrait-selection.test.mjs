import assert from 'node:assert/strict';
import test from 'node:test';

import { findNeutralImage } from '../portrait-selection.js';

test('prefers a neutral portrait regardless of list order', () => {
    const images = [{ name: 'happy.png' }, { name: 'neutral.png' }, { name: 'angry.png' }];
    assert.equal(findNeutralImage(images)?.name, 'neutral.png');
});

test('recognizes common default portrait names', () => {
    assert.equal(findNeutralImage([{ name: 'default.webp' }])?.name, 'default.webp');
    assert.equal(findNeutralImage([{ name: '네츄럴.png' }])?.name, '네츄럴.png');
});

