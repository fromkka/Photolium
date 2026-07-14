import { extension_settings } from '../../../extensions.js';
import { findNeutralImage } from './portrait-selection.js';

export { findNeutralImage } from './portrait-selection.js';

export const MODULE_NAME = 'photolium';
export const EXTENSION_PATH = 'third-party/Photolium';
export const PROMPT_KEY = 'photolium_emotion_tags';

export const THEME_PRESETS = {
    daylight: {
        accent: '#3f99d4', panel: '#fffdfaf7', bubble: '#fffffff7', text: '#292b2e', muted: '#7a8087',
        backdrop: '#f3f5f7', radius: 16,
    },
    cottage: {
        accent: '#758d3f', panel: '#fff8e8f5', bubble: '#fffaf0fa', text: '#3f2c18', muted: '#8a7358',
        backdrop: '#f4e7c7', radius: 18,
    },
    rose: {
        accent: '#c47783', panel: '#fff8f8f5', bubble: '#fffafbfa', text: '#4b3036', muted: '#92727a',
        backdrop: '#f6e8eb', radius: 20,
    },
    lavender: {
        accent: '#8172bd', panel: '#fbf9fff5', bubble: '#fefcfffa', text: '#38344d', muted: '#7d7793',
        backdrop: '#eeeaf8', radius: 20,
    },
    midnight: {
        accent: '#e9c46a', panel: '#111831e8', bubble: '#1c2848e8', text: '#fffaf0', muted: '#c9ccdc',
        backdrop: '#070b1db8', radius: 24,
    },
    parchment: {
        accent: '#9a6a2f', panel: '#fffaf0eb', bubble: '#fffdf6f2', text: '#372719', muted: '#766556',
        backdrop: '#3b291b73', radius: 18,
    },
    glass: {
        accent: '#8dd8ff', panel: '#15243ba8', bubble: '#eaf7ffcf', text: '#f4fbff', muted: '#c2d4df',
        backdrop: '#08121f8c', radius: 30,
    },
    minimal: {
        accent: '#ffffff', panel: '#171717ed', bubble: '#262626ed', text: '#ffffff', muted: '#b7b7b7',
        backdrop: '#0000008f', radius: 8,
    },
};

const DEFAULT_SETTINGS = {
    settingsVersion: 4,
    promptEnabled: true,
    typingEnabled: true,
    portraitFadeEnabled: true,
    typingSpeed: 42,
    paragraphDelay: 320,
    fontSize: 18,
    portraitWidth: 27,
    backgroundDim: 12,
    backgroundBlur: 0,
    portraitFit: 'cover',
    backgroundFit: 'cover',
    preset: 'daylight',
    theme: THEME_PRESETS.daylight,
    profiles: {},
};

export function ensureSettings() {
    const existing = extension_settings[MODULE_NAME] ?? {};
    const merged = {
        ...structuredClone(DEFAULT_SETTINGS),
        ...existing,
        theme: { ...DEFAULT_SETTINGS.theme, ...(existing.theme ?? {}) },
        profiles: existing.profiles && typeof existing.profiles === 'object' ? existing.profiles : {},
    };

    // Version 3 establishes the full-width light studio layout.
    if (Number(existing.settingsVersion ?? 0) < 3) {
        merged.settingsVersion = 3;
        merged.preset = 'daylight';
        merged.theme = { ...THEME_PRESETS.daylight };
        merged.fontSize = 18;
        merged.portraitWidth = 27;
        merged.portraitFit = 'cover';
        merged.backgroundDim = 12;
    }

    // Version 4 enables portrait fades and prefers neutral.* as the initial portrait.
    if (Number(existing.settingsVersion ?? 0) < 4) {
        merged.settingsVersion = 4;
        merged.portraitFadeEnabled = true;
        for (const profile of Object.values(merged.profiles)) {
            const neutral = findNeutralImage(profile?.images);
            if (neutral) profile.defaultImage = neutral.name;
        }
    }

    extension_settings[MODULE_NAME] = merged;
    return merged;
}

export function getSettings() {
    return extension_settings[MODULE_NAME] ?? ensureSettings();
}

export function getProfileKey(context) {
    if (context.groupId) return `group_${context.groupId}`;
    const character = context.characters?.[context.characterId];
    if (!character) return null;
    return `character_${character.avatar || context.characterId}`;
}

export function getProfile(context, create = false) {
    const key = getProfileKey(context);
    if (!key) return null;
    const settings = getSettings();
    if (!settings.profiles[key] && create) {
        settings.profiles[key] = {
            name: context.name2 || 'Character',
            images: [],
            defaultImage: null,
            background: null,
        };
    }
    const profile = settings.profiles[key] ?? null;
    if (profile) {
        profile.images = Array.isArray(profile.images) ? profile.images : [];
        profile.name = context.name2 || profile.name || 'Character';
        profile.defaultImage ||= findNeutralImage(profile.images)?.name ?? profile.images[0]?.name ?? null;
    }
    return profile;
}

export function buildEmotionPrompt(context) {
    const settings = getSettings();
    const profile = getProfile(context);
    const names = profile?.images?.map(image => image.name).filter(Boolean) ?? [];
    if (!settings.promptEnabled || !names.length) return '';

    return [
        '[Photolium — mandatory response format]',
        `Allowed emotion portrait filenames: ${names.join(', ')}`,
        'For EVERY paragraph, put exactly one [filename.ext] tag on a separate first line immediately before the paragraph\'s first sentence.',
        'Choose only from the allowed filenames and select the image matching the emotion in that specific paragraph.',
        'Repeat a tag for every paragraph, even when the emotion did not change. Change tags whenever the emotion changes within one response.',
        'Separate paragraphs with one blank line. Never invent filenames, omit a paragraph tag, or explain this formatting rule.',
        `Required example:\n[${names[0]}]\nFirst paragraph text.\n\n[${names[Math.min(1, names.length - 1)]}]\nSecond paragraph text.`,
    ].join('\n');
}

export function applyTheme(root) {
    if (!(root instanceof HTMLElement)) return;
    const settings = getSettings();
    const theme = settings.theme;
    root.dataset.photoliumTheme = settings.preset || 'custom';
    root.style.setProperty('--photolium-accent', theme.accent);
    root.style.setProperty('--photolium-panel', theme.panel);
    root.style.setProperty('--photolium-bubble', theme.bubble);
    root.style.setProperty('--photolium-text', theme.text);
    root.style.setProperty('--photolium-muted', theme.muted);
    root.style.setProperty('--photolium-backdrop', theme.backdrop);
    root.style.setProperty('--photolium-radius', `${theme.radius}px`);
    root.style.setProperty('--photolium-font-size', `${settings.fontSize}px`);
    root.style.setProperty('--photolium-portrait-width', `${settings.portraitWidth}%`);
    root.style.setProperty('--photolium-bg-blur', `${settings.backgroundBlur}px`);
    root.style.setProperty('--photolium-bg-dim', `${settings.backgroundDim / 100}`);
    root.style.setProperty('--photolium-portrait-fit', settings.portraitFit);
    root.style.setProperty('--photolium-background-fit', settings.backgroundFit);
}

export function applyPreset(name) {
    if (!Object.hasOwn(THEME_PRESETS, name)) return;
    const settings = getSettings();
    settings.preset = name;
    settings.theme = { ...THEME_PRESETS[name] };
}
