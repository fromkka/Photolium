import { assetUrl } from './assets.js';
import { BACKGROUND_PRESETS } from './background-presets.js';

export class PhotoliumUI {
    constructor(callbacks) {
        this.callbacks = callbacks;
        this.root = document.getElementById('photolium-app');
        this.settingsRoot = document.getElementById('photolium-settings');
        this.dialogue = document.getElementById('photolium-dialogue');
        this.portrait = document.getElementById('photolium-portrait');
        this.portraitNext = document.getElementById('photolium-portrait-next');
        this.portraitLabel = document.getElementById('photolium-portrait-label');
        this.characterName = document.getElementById('photolium-character-name');
        this.textarea = document.getElementById('photolium-textarea');
        this.background = this.root.querySelector('.photolium-scene-background');
        this.portraitFrame = this.root.querySelector('.photolium-portrait-frame');
        this.bindEvents();
    }

    bindEvents() {
        document.querySelectorAll('[data-photolium-action="enter"]').forEach(button => button.addEventListener('click', this.callbacks.onEnter));
        this.root.querySelector('[data-photolium-action="exit"]').addEventListener('click', this.callbacks.onExit);
        document.getElementById('photolium-send').addEventListener('click', () => this.submit());
        this.textarea.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                this.submit();
            }
        });
        this.dialogue.addEventListener('click', this.callbacks.onSkip);

        this.bindEmotionInput(document.getElementById('photolium-emotion-input'));
        this.bindEmotionInput(document.getElementById('photolium-stage-emotion-input'));
        this.bindBackgroundInput(document.getElementById('photolium-background-input'));
        this.bindBackgroundInput(document.getElementById('photolium-stage-background-input'));

        this.root.addEventListener('click', event => {
            const button = event.target.closest('[data-photolium-action]');
            if (!button) return;
            const action = button.dataset.photoliumAction;
            if (action === 'remove-background') this.callbacks.onRemoveBackground();
            if (action === 'background-preset') this.callbacks.onBackgroundPreset(button.dataset.presetId);
            if (action === 'theme-preset') this.callbacks.onPreset(button.dataset.preset);
        });

        this.settingsRoot.addEventListener('click', event => {
            const button = event.target.closest('[data-photolium-action]');
            if (!button) return;
            const action = button.dataset.photoliumAction;
            if (action === 'remove-image') this.callbacks.onRemoveImage(Number(button.dataset.index));
            if (action === 'default-image') this.callbacks.onDefaultImage(Number(button.dataset.index));
            if (action === 'remove-background') this.callbacks.onRemoveBackground();
        });

        document.querySelectorAll('[data-photolium-setting]').forEach(input => {
            input.addEventListener('input', () => this.callbacks.onSetting(input.dataset.photoliumSetting, readInput(input)));
        });
        document.querySelectorAll('[data-photolium-theme]').forEach(input => {
            input.addEventListener('change', () => this.callbacks.onTheme(input.dataset.photoliumTheme, readInput(input)));
        });
        document.getElementById('photolium-preset').addEventListener('change', event => this.callbacks.onPreset(event.target.value));
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && this.isActive() && !event.defaultPrevented) this.callbacks.onExit();
        });
    }

    bindEmotionInput(input) {
        input.addEventListener('change', event => {
            this.callbacks.onEmotionFiles([...event.target.files]);
            event.target.value = '';
        });
    }

    bindBackgroundInput(input) {
        input.addEventListener('change', event => {
            const [file] = event.target.files;
            if (file) this.callbacks.onBackgroundFile(file);
            event.target.value = '';
        });
    }

    submit() {
        const text = this.textarea.value.trim();
        if (!text) {
            this.callbacks.onRetry();
            return;
        }
        if (this.callbacks.onSend(text) !== false) this.textarea.value = '';
    }

    setActive(active) {
        this.root.classList.toggle('photolium-active', active);
        this.root.setAttribute('aria-hidden', String(!active));
        document.body.classList.toggle('photolium-mode-open', active);
        if (active) setTimeout(() => this.textarea.focus(), 50);
    }

    isActive() {
        return this.root.classList.contains('photolium-active');
    }

    setScene({ name, background }) {
        this.characterName.textContent = name || 'Character';
        const url = assetUrl(background);
        const defaultBackground = getComputedStyle(document.getElementById('bg1') ?? document.body).backgroundImage;
        const backgroundImage = url ? `url("${cssUrl(url)}")` : defaultBackground;
        this.background.style.backgroundImage = backgroundImage;
        this.portraitFrame.style.backgroundImage = backgroundImage;
        this.root.classList.toggle('photolium-has-background', Boolean(url));
        this.portraitFrame.classList.toggle('photolium-has-background', Boolean(url));
    }

    showUserMessage(text) {
        const line = document.createElement('article');
        line.className = 'photolium-user-line';
        line.textContent = text;
        this.dialogue.append(line);
        this.dialogue.scrollTop = this.dialogue.scrollHeight;
    }

    setWaiting(waiting, label = '답변을 기다리는 중') {
        const status = document.getElementById('photolium-status');
        status.lastChild.textContent = ` ${label}`;
        status.hidden = !waiting;
    }

    renderSettings(settings, profile, profileName = '') {
        document.getElementById('photolium-profile-name').textContent = profileName || '채팅을 먼저 여세요';
        this.renderImages(profile);
        this.renderBackground(profile);

        document.querySelectorAll('[data-photolium-setting]').forEach(input => writeInput(input, settings[input.dataset.photoliumSetting]));
        document.querySelectorAll('[data-photolium-theme]').forEach(input => writeInput(input, settings.theme[input.dataset.photoliumTheme]));
        document.getElementById('photolium-preset').value = settings.preset || 'custom';
        this.root.querySelectorAll('[data-photolium-action="theme-preset"]').forEach(button => {
            button.classList.toggle('photolium-selected', button.dataset.preset === settings.preset);
        });

        const outputValues = {
            typingSpeed: `${settings.typingSpeed}자/초`, paragraphDelay: `${settings.paragraphDelay}ms`,
            fontSize: `${settings.fontSize}px`, portraitWidth: `${settings.portraitWidth}%`,
            backgroundDim: `${settings.backgroundDim}%`, backgroundBlur: `${settings.backgroundBlur}px`,
            'theme.radius': `${settings.theme.radius}px`,
        };
        for (const [name, value] of Object.entries(outputValues)) {
            document.querySelectorAll(`[data-photolium-output="${name}"]`).forEach(output => { output.textContent = value; });
        }
    }

    renderImages(profile) {
        const images = profile?.images ?? [];
        this.renderSettingsImageList(document.getElementById('photolium-image-list'), images, profile);
        this.renderStageImageList(document.getElementById('photolium-stage-image-list'), images);
        document.getElementById('photolium-stage-image-count').textContent = `${images.length}개`;
    }

    renderSettingsImageList(list, images, profile) {
        list.replaceChildren();
        if (!images.length) {
            list.append(createEmptyMessage('등록된 이미지가 없습니다. 봇 프로필 이미지를 사용합니다.'));
            return;
        }

        images.forEach((image, index) => {
            const row = document.createElement('div');
            row.className = 'photolium-image-row';
            const preview = createPreview(image);
            const name = document.createElement('code');
            name.textContent = image.name;
            const primary = document.createElement('button');
            primary.type = 'button';
            primary.className = 'menu_button';
            primary.dataset.photoliumAction = 'default-image';
            primary.dataset.index = String(index);
            primary.textContent = profile.defaultImage === image.name ? '기본' : '기본 지정';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'menu_button';
            remove.dataset.photoliumAction = 'remove-image';
            remove.dataset.index = String(index);
            remove.title = '삭제';
            const removeIcon = document.createElement('i');
            removeIcon.className = 'fa-solid fa-trash';
            remove.append(removeIcon);
            row.append(preview, name, primary, remove);
            list.append(row);
        });
    }

    renderStageImageList(list, images) {
        list.replaceChildren();
        if (!images.length) {
            list.append(createEmptyMessage('이미지를 추가하면 파일명이 여기에 표시됩니다.'));
            return;
        }

        images.forEach(image => {
            const row = document.createElement('div');
            row.className = 'photolium-stage-image-row';
            const preview = createPreview(image);
            const name = document.createElement('code');
            name.textContent = image.name;
            const status = document.createElement('span');
            status.className = 'photolium-ready-label';
            status.innerHTML = '<i class="fa-solid fa-circle"></i> 준비됨';
            row.append(preview, name, status);
            list.append(row);
        });
    }

    renderBackground(profile) {
        const url = assetUrl(profile?.background);
        const preview = document.getElementById('photolium-background-preview');
        preview.style.backgroundImage = url ? `url("${cssUrl(url)}")` : '';
        preview.textContent = url ? '' : '기본 SillyTavern 배경 사용';

        const presets = document.getElementById('photolium-background-presets');
        if (!presets.hasChildNodes()) {
            for (const preset of BACKGROUND_PRESETS) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'photolium-background-preset';
                button.dataset.photoliumAction = 'background-preset';
                button.dataset.presetId = preset.id;
                button.style.backgroundImage = `url("${cssUrl(preset.path)}")`;
                const name = document.createElement('span');
                name.textContent = preset.name;
                button.append(name);
                presets.append(button);
            }
        }
        presets.querySelectorAll('[data-preset-id]').forEach(button => {
            button.classList.toggle('photolium-selected', profile?.background?.presetId === button.dataset.presetId);
        });
    }
}

function createPreview(image) {
    const preview = document.createElement('img');
    preview.src = assetUrl(image);
    preview.alt = '';
    return preview;
}

function createEmptyMessage(text) {
    const empty = document.createElement('p');
    empty.className = 'photolium-empty';
    empty.textContent = text;
    return empty;
}

function readInput(input) {
    if (input.type === 'checkbox') return input.checked;
    if (input.type === 'range' || input.type === 'number') return Number(input.value);
    return input.value;
}

function writeInput(input, value) {
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else if (value !== undefined && value !== null) input.value = String(value);
}

function cssUrl(value) {
    return String(value).replace(/["\\\n\r]/g, character => `\\${character}`);
}
