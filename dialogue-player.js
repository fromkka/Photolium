export class DialoguePlayer {
    constructor({ root, portrait, portraitNext, portraitLabel, dialogue, getSettings, resolvePortrait }) {
        this.root = root;
        this.portrait = portrait;
        this.portraitNext = portraitNext;
        this.portraitLabel = portraitLabel;
        this.dialogue = dialogue;
        this.getSettings = getSettings;
        this.resolvePortrait = resolvePortrait;
        this.runId = 0;
        this.portraitTransitionId = 0;
        this.skipCurrent = false;
        this.isPlaying = false;
    }

    cancel() {
        this.runId += 1;
        this.portraitTransitionId += 1;
        this.skipCurrent = true;
        this.isPlaying = false;
        this.root.classList.remove('photolium-is-typing');
        const frame = this.getPortraitFrame();
        frame?.classList.remove('photolium-portrait-crossfading', 'photolium-portrait-commit');
        this.clearNextPortrait();
    }

    skip() {
        if (this.isPlaying) this.skipCurrent = true;
    }

    clear() {
        this.cancel();
        this.dialogue.replaceChildren();
    }

    async setPortrait(emotion, fallbackUrl, { immediate = false } = {}) {
        const transitionId = ++this.portraitTransitionId;
        const resolved = this.resolvePortrait(emotion, fallbackUrl);
        const frame = this.getPortraitFrame();

        if (!resolved?.url) {
            this.portrait.removeAttribute('src');
            this.clearNextPortrait();
            frame?.classList.add('photolium-no-portrait');
            this.portraitLabel.textContent = '';
            return;
        }

        const targetUrl = new URL(resolved.url, location.href).href;
        const applyPortrait = () => {
            frame?.classList.remove('photolium-no-portrait');
            this.portrait.src = resolved.url;
            this.portrait.alt = resolved.label || 'Portrait';
            this.portraitLabel.textContent = resolved.label || '';
            this.clearNextPortrait();
        };

        if (this.portrait.src === targetUrl) {
            this.portrait.alt = resolved.label || 'Portrait';
            this.portraitLabel.textContent = resolved.label || '';
            return;
        }

        const fadeEnabled = Boolean(this.getSettings().portraitFadeEnabled);
        if (immediate || !fadeEnabled || !this.portrait.getAttribute('src')) {
            applyPortrait();
            return;
        }

        this.portraitNext.src = resolved.url;
        this.portraitNext.alt = resolved.label || 'Portrait';
        this.portraitNext.setAttribute('aria-hidden', 'false');
        await waitForImage(this.portraitNext, 800);
        if (transitionId !== this.portraitTransitionId) return;

        frame?.classList.remove('photolium-no-portrait');
        frame?.classList.add('photolium-portrait-crossfading');
        await delay(320);
        if (transitionId !== this.portraitTransitionId) return;

        frame?.classList.add('photolium-portrait-commit');
        this.portrait.src = resolved.url;
        this.portrait.alt = resolved.label || 'Portrait';
        this.portraitLabel.textContent = resolved.label || '';
        frame?.classList.remove('photolium-portrait-crossfading');
        this.clearNextPortrait();
        void frame?.offsetWidth;
        frame?.classList.remove('photolium-portrait-commit');
    }

    renderInstant(items, { fallbackUrl = '', speaker = '' } = {}) {
        this.clear();
        this.appendInstant(items, { fallbackUrl, speaker });
    }

    appendInstant(items, { fallbackUrl = '', speaker = '' } = {}) {
        for (const item of items) {
            this.dialogue.append(this.createCard(item, speaker, item.text));
        }
        const finalItem = items.at(-1);
        this.setPortrait(finalItem?.emotion ?? null, fallbackUrl, { immediate: true });
        this.scrollToEnd();
    }

    async play(items, { fallbackUrl = '', speaker = '' } = {}) {
        this.cancel();
        const runId = this.runId;
        this.isPlaying = true;
        this.root.classList.add('photolium-is-typing');

        for (const item of items) {
            if (runId !== this.runId) return;
            await this.setPortrait(item.emotion, fallbackUrl);
            if (runId !== this.runId) return;

            const card = this.createCard(item, speaker, '');
            const textNode = card.querySelector('.photolium-paragraph-text');
            this.dialogue.append(card);
            this.scrollToEnd();
            await this.typeText(textNode, item.text, runId);
            if (runId !== this.runId) return;
            await delay(this.getSettings().paragraphDelay);
        }

        if (runId === this.runId) {
            this.isPlaying = false;
            this.root.classList.remove('photolium-is-typing');
        }
    }

    async typeText(node, text, runId) {
        const settings = this.getSettings();
        if (!settings.typingEnabled) {
            node.textContent = text;
            return;
        }

        this.skipCurrent = false;
        const speed = Math.max(5, Number(settings.typingSpeed) || 42);
        const interval = 1000 / speed;
        for (let index = 0; index < text.length; index += 1) {
            if (runId !== this.runId) return;
            if (this.skipCurrent) {
                node.textContent = text;
                this.skipCurrent = false;
                this.scrollToEnd();
                return;
            }
            node.textContent += text[index];
            if (index % 3 === 0) this.scrollToEnd();
            await delay(/[\s]/.test(text[index]) ? interval * 0.45 : interval);
        }
    }

    createCard(item, speaker, text) {
        const card = document.createElement('article');
        card.className = 'photolium-dialogue-card';
        card.style.setProperty('--photolium-emotion-color', emotionColor(item.emotion));

        const header = document.createElement('header');
        const name = document.createElement('strong');
        name.textContent = speaker;
        const tag = document.createElement('span');
        tag.className = 'photolium-emotion-tag';
        tag.textContent = item.emotion ? `[${item.emotion}]` : '';
        header.append(name, tag);

        const paragraph = document.createElement('div');
        paragraph.className = 'photolium-paragraph-text';
        paragraph.textContent = text;
        card.append(header, paragraph);
        return card;
    }

    getPortraitFrame() {
        return this.portrait.closest('.photolium-portrait-frame');
    }

    clearNextPortrait() {
        this.portraitNext?.removeAttribute('src');
        this.portraitNext?.removeAttribute('alt');
        this.portraitNext?.setAttribute('aria-hidden', 'true');
    }

    scrollToEnd() {
        this.dialogue.scrollTop = this.dialogue.scrollHeight;
    }
}

function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(milliseconds) || 0)));
}

function waitForImage(image, timeout) {
    if (image.complete) return Promise.resolve();
    return Promise.race([
        new Promise(resolve => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
        }),
        delay(timeout),
    ]);
}

function emotionColor(emotion) {
    const name = String(emotion ?? '').toLocaleLowerCase();
    if (/angry|mad|rage|화남|분노/.test(name)) return '#e05248';
    if (/happy|smile|joy|기쁨|행복/.test(name)) return '#4c9a59';
    if (/shy|blush|수줍|부끄/.test(name)) return '#9a63c7';
    if (/sad|cry|우울|슬픔/.test(name)) return '#4f83bd';
    return '#718096';
}
