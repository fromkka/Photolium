import assert from 'node:assert/strict';
import test from 'node:test';

import { BACKGROUND_PRESETS, getBackgroundPreset, toBackgroundAsset } from '../background-presets.js';

test('ships three selectable background scenes', () => {
    assert.equal(BACKGROUND_PRESETS.length, 3);
    for (const preset of BACKGROUND_PRESETS) {
        assert.match(preset.path, /^\/scripts\/extensions\/third-party\/Photolium\/assets\/backgrounds\/.+\.png$/);
        assert.equal(getBackgroundPreset(preset.id), preset);
    }
});

test('marks bundled backgrounds so they are never deleted as user uploads', () => {
    const asset = toBackgroundAsset(BACKGROUND_PRESETS[0]);
    assert.equal(asset.bundled, true);
    assert.equal(asset.presetId, BACKGROUND_PRESETS[0].id);
});
