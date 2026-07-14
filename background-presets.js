export const BACKGROUND_PRESETS = [
    {
        id: 'sunlit-reading-room',
        name: '햇살 독서실',
        path: '/scripts/extensions/third-party/Photolium/assets/backgrounds/sunlit-reading-room.png',
    },
    {
        id: 'blue-hour-street',
        name: '비 갠 저녁길',
        path: '/scripts/extensions/third-party/Photolium/assets/backgrounds/blue-hour-street.png',
    },
    {
        id: 'moonlit-conservatory',
        name: '달빛 온실',
        path: '/scripts/extensions/third-party/Photolium/assets/backgrounds/moonlit-conservatory.png',
    },
];

export function getBackgroundPreset(id) {
    return BACKGROUND_PRESETS.find(preset => preset.id === id) ?? null;
}

export function toBackgroundAsset(preset) {
    if (!preset) return null;
    return {
        name: preset.name,
        path: preset.path,
        updatedAt: 1,
        bundled: true,
        presetId: preset.id,
    };
}
