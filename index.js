import { getContext, renderExtensionTemplateAsync } from '../../../extensions.js';
import { assetUrl, deleteImageFile, uploadBackgroundFile, uploadEmotionFile } from './assets.js';
import { getBackgroundPreset, toBackgroundAsset } from './background-presets.js';
import { DialoguePlayer } from './dialogue-player.js';
import { parseEmotionMessage } from './emotion-parser.js';
import {
    EXTENSION_PATH,
    PROMPT_KEY,
    applyPreset,
    applyTheme,
    buildEmotionPrompt,
    ensureSettings,
    findNeutralImage,
    getProfile,
    getProfileKey,
    getSettings,
} from './settings.js';
import { PhotoliumUI } from './ui.js';

let initialized = false;
let modeActive = false;
let retryInFlight = false;
let ui;
let player;

export async function init() {
    if (initialized) return;
    initialized = true;
    ensureSettings();

    const [settingsHtml, overlayHtml] = await Promise.all([
        renderExtensionTemplateAsync(EXTENSION_PATH, 'settings'),
        renderExtensionTemplateAsync(EXTENSION_PATH, 'overlay'),
    ]);
    document.getElementById('extensions_settings2')?.insertAdjacentHTML('beforeend', settingsHtml);
    document.body.insertAdjacentHTML('beforeend', overlayHtml);

    ui = new PhotoliumUI({
        onEnter: enterMode,
        onExit: exitMode,
        onSend: sendMessage,
        onRetry: retryGeneration,
        onSkip: () => player?.skip(),
        onEmotionFiles: addEmotionFiles,
        onBackgroundFile: setBackground,
        onBackgroundPreset: setBackgroundPreset,
        onRemoveImage: removeEmotionImage,
        onDefaultImage: setDefaultImage,
        onRemoveBackground: removeBackground,
        onSetting: changeSetting,
        onTheme: changeTheme,
        onPreset: changePreset,
    });

    player = new DialoguePlayer({
        root: ui.root,
        portrait: ui.portrait,
        portraitNext: ui.portraitNext,
        portraitLabel: ui.portraitLabel,
        dialogue: ui.dialogue,
        getSettings,
        resolvePortrait,
    });

    installEntryButton();
    installEventListeners();
    refreshAll();
    updatePrompt();
}

function installEntryButton() {
    if (document.getElementById('photolium-enter-button')) return;
    const button = document.createElement('div');
    button.id = 'photolium-enter-button';
    button.className = 'fa-solid fa-camera-retro interactable';
    button.title = 'Photolium 열기';
    button.tabIndex = 0;
    button.addEventListener('click', enterMode);
    button.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') enterMode();
    });
    document.getElementById('leftSendForm')?.append(button);
}

function installEventListeners() {
    const context = getContext();
    const events = context.eventTypes;
    context.eventSource.on(events.MESSAGE_RECEIVED, onMessageReceived);
    context.eventSource.on(events.MESSAGE_SWIPED, onMessageReplaced);
    context.eventSource.on(events.MESSAGE_EDITED, onMessageReplaced);
    context.eventSource.on(events.MESSAGE_UPDATED, onMessageReplaced);
    context.eventSource.on(events.CHAT_CHANGED, onChatChanged);
    context.eventSource.on(events.CHAT_LOADED, onChatChanged);
    context.eventSource.on(events.GENERATION_STARTED, () => {
        if (modeActive) {
            updatePrompt();
            ui.setWaiting(true);
        }
    });
    context.eventSource.on(events.GENERATION_STOPPED, () => {
        if (modeActive) ui.setWaiting(false);
    });
    context.eventSource.on(events.GENERATION_ENDED, () => {
        if (modeActive) ui.setWaiting(false);
    });
}

function enterMode() {
    const context = getContext();
    if (!getProfileKey(context)) {
        notify('warning', '먼저 캐릭터 또는 그룹 채팅을 열어주세요.');
        return;
    }
    modeActive = true;
    updatePrompt();
    refreshAll();
    ui.setActive(true);
    renderConversationHistory();
}

async function exitMode() {
    if (!modeActive) return;
    const context = getContext();
    modeActive = false;
    player.cancel();
    ui.setWaiting(false);
    ui.setActive(false);
    updatePrompt();
    try {
        await context.saveChat();
        await context.reloadCurrentChat();
    } catch (error) {
        console.error('[Photolium] Failed to refresh the default chat', error);
        notify('warning', '기본 채팅 화면을 새로고침하지 못했습니다. 채팅을 다시 열어 주세요.');
    } finally {
        document.getElementById('send_textarea')?.focus();
    }
}

function sendMessage(text) {
    const source = document.getElementById('send_textarea');
    const sendButton = document.getElementById('send_but');
    if (!(source instanceof HTMLTextAreaElement) || !sendButton) {
        notify('warning', '현재 SillyTavern에서 메시지를 전송할 수 없습니다. API 연결 상태를 확인하세요.');
        return false;
    }

    updatePrompt();
    source.value = text;
    source.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    ui.showUserMessage(text);
    ui.setWaiting(true);
    player.cancel();
    sendButton.click();
    return true;
}

async function retryGeneration() {
    if (!modeActive) return false;
    if (retryInFlight) {
        notify('info', '이미 AI를 호출하고 있습니다.');
        return false;
    }
    retryInFlight = true;
    updatePrompt();
    ui.setWaiting(true, 'AI를 다시 호출하는 중');
    try {
        await getContext().generate('regenerate');
        return true;
    } catch (error) {
        console.error('[Photolium] Retry generation failed', error);
        ui.setWaiting(false);
        notify('error', 'AI 재호출에 실패했습니다. 연결 상태를 확인하세요.');
        return false;
    } finally {
        retryInFlight = false;
        ui.setWaiting(false);
    }
}

async function onMessageReceived(messageId) {
    if (!modeActive) return;
    const context = getContext();
    const message = context.chat?.[Number(messageId)];
    if (!message || message.is_user || message.is_system) return;
    ui.setWaiting(false);
    await context.saveChat();
    await renderMessage(message, false);
}

function onMessageReplaced(messageId) {
    if (!modeActive) return;
    const message = getContext().chat?.[Number(messageId)];
    if (message && !message.is_user && !message.is_system) renderConversationHistory();
}

function onChatChanged() {
    player?.cancel();
    refreshAll();
    updatePrompt();
    if (modeActive) renderConversationHistory();
}

function renderConversationHistory() {
    const context = getContext();
    const visibleMessages = (context.chat ?? []).filter(message => !message.is_system);
    const firstMessage = visibleMessages[0];
    const recentMessages = visibleMessages.length > 60
        ? [firstMessage, ...visibleMessages.slice(-59).filter(message => message !== firstMessage)]
        : visibleMessages;

    player.clear();
    if (!recentMessages.length) {
        player.setPortrait(null, fallbackAvatar(null, context), { immediate: true });
        return;
    }

    for (const message of recentMessages) {
        if (message.is_user) ui.showUserMessage(message.mes);
        else appendMessageInstant(message, context);
    }
}

function appendMessageInstant(message, context = getContext()) {
    const profile = getProfile(context);
    const items = parseEmotionMessage(message.mes, profile?.images, profile?.defaultImage);
    player.appendInstant(items, {
        fallbackUrl: fallbackAvatar(message, context),
        speaker: message.name || context.name2 || profile?.name || 'Character',
    });
}

async function renderMessage(message, instant) {
    const context = getContext();
    const profile = getProfile(context);
    const items = parseEmotionMessage(message.mes, profile?.images, profile?.defaultImage);
    const playbackOptions = {
        fallbackUrl: fallbackAvatar(message, context),
        speaker: message.name || context.name2 || profile?.name || 'Character',
    };
    if (instant) player.renderInstant(items, playbackOptions);
    else await player.play(items, playbackOptions);
}

function resolvePortrait(emotion, fallbackUrl) {
    const profile = getProfile(getContext());
    const image = profile?.images?.find(item => item.name.toLocaleLowerCase() === String(emotion).toLocaleLowerCase());
    if (image) return { url: assetUrl(image), label: image.name };
    return { url: fallbackUrl, label: profile?.images?.length ? '봇 프로필 (태그 없음)' : '봇 프로필' };
}

function fallbackAvatar(message, context) {
    if (message?.force_avatar) return message.force_avatar;
    if (message?.original_avatar) return context.getThumbnailUrl('avatar', message.original_avatar);
    const character = context.characters?.[context.characterId];
    if (character?.avatar && character.avatar !== 'none') return context.getThumbnailUrl('avatar', character.avatar);
    return '';
}

async function addEmotionFiles(files) {
    const context = getContext();
    const key = getProfileKey(context);
    if (!key || !files.length) return;
    const profile = getProfile(context, true);
    let successCount = 0;

    for (const file of files) {
        try {
            const uploaded = await uploadEmotionFile(file, key);
            const index = profile.images.findIndex(image => image.name.toLocaleLowerCase() === uploaded.name.toLocaleLowerCase());
            if (index >= 0) profile.images[index] = uploaded;
            else profile.images.push(uploaded);
            const uploadedIsNeutral = findNeutralImage([uploaded]);
            if (uploadedIsNeutral) profile.defaultImage = uploaded.name;
            else profile.defaultImage ||= uploaded.name;
            successCount += 1;
        } catch (error) {
            console.error('[Photolium] Image upload failed', error);
            notify('error', `${file.name}: ${error.message}`);
        }
    }

    if (successCount) {
        persist();
        refreshAll();
        updatePrompt();
        notify('success', `${successCount}개의 감정 이미지를 저장했습니다.`);
    }
}

async function setBackground(file) {
    const context = getContext();
    const key = getProfileKey(context);
    if (!key) return;
    try {
        const profile = getProfile(context, true);
        const oldBackground = profile.background;
        profile.background = await uploadBackgroundFile(file, key);
        if (oldBackground?.path && !oldBackground.bundled && oldBackground.path !== profile.background.path) {
            await deleteImageFile(oldBackground.path, context.getRequestHeaders);
        }
        persist();
        refreshAll();
        notify('success', 'Photolium 배경을 저장했습니다.');
    } catch (error) {
        console.error('[Photolium] Background upload failed', error);
        notify('error', error.message);
    }
}

async function setBackgroundPreset(id) {
    const preset = getBackgroundPreset(id);
    if (!preset) return;
    const context = getContext();
    const profile = getProfile(context, true);
    if (!profile) return;
    const oldBackground = profile.background;
    profile.background = toBackgroundAsset(preset);
    if (oldBackground?.path && !oldBackground.bundled && oldBackground.path !== profile.background.path) {
        await deleteImageFile(oldBackground.path, context.getRequestHeaders);
    }
    persist();
    refreshAll();
}

async function removeEmotionImage(index) {
    const context = getContext();
    const profile = getProfile(context);
    const image = profile?.images?.[index];
    if (!image) return;
    if (!await deleteImageFile(image.path, context.getRequestHeaders)) {
        notify('error', '이미지 파일을 삭제하지 못했습니다.');
        return;
    }
    profile.images.splice(index, 1);
    if (profile.defaultImage === image.name) {
        profile.defaultImage = findNeutralImage(profile.images)?.name ?? profile.images[0]?.name ?? null;
    }
    persist();
    refreshAll();
    updatePrompt();
}

function setDefaultImage(index) {
    const profile = getProfile(getContext());
    if (!profile?.images?.[index]) return;
    profile.defaultImage = profile.images[index].name;
    persist();
    refreshAll();
}

async function removeBackground() {
    const context = getContext();
    const profile = getProfile(context);
    if (!profile?.background) return;
    if (!profile.background.bundled && !await deleteImageFile(profile.background.path, context.getRequestHeaders)) {
        notify('error', '배경 파일을 삭제하지 못했습니다.');
        return;
    }
    profile.background = null;
    persist();
    refreshAll();
}

function changeSetting(name, value) {
    const settings = getSettings();
    settings[name] = value;
    persist();
    refreshAll();
    if (name === 'promptEnabled') updatePrompt();
}

function changeTheme(name, value) {
    const settings = getSettings();
    settings.theme[name] = name === 'radius' ? Number(value) : String(value);
    settings.preset = 'custom';
    persist();
    refreshAll();
}

function changePreset(name) {
    if (name === 'custom') return;
    applyPreset(name);
    persist();
    refreshAll();
}

function refreshAll() {
    if (!ui) return;
    const context = getContext();
    const profile = getProfile(context);
    const settings = getSettings();
    const profileName = getProfileKey(context) ? (context.name2 || profile?.name || '') : '';
    ui.renderSettings(settings, profile, profileName);
    ui.setScene({ name: context.name2 || profile?.name, background: profile?.background });
    applyTheme(ui.root);
}

function updatePrompt() {
    const context = getContext();
    const value = modeActive ? buildEmotionPrompt(context) : '';
    context.setExtensionPrompt(PROMPT_KEY, value, 1, 0, false);
}

function persist() {
    getContext().saveSettingsDebounced();
}

function notify(level, message) {
    if (globalThis.toastr?.[level]) globalThis.toastr[level](message, 'Photolium');
    else console[level === 'error' ? 'error' : 'log'](`[Photolium] ${message}`);
}
