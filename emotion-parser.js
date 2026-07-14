const IMAGE_TAG = /^\s*\[([^\]\r\n]+?\.(?:png|jpe?g|jfif|webp|gif|bmp))\]\s*(?:\r?\n)?/gim;

/**
 * Turns a tagged assistant message into paragraph-sized playback units.
 * An untagged paragraph inherits the last valid emotion image.
 *
 * @param {string} source Raw assistant message.
 * @param {{name:string}[]} images Configured emotion images.
 * @param {string|null} defaultName Preferred starting image name.
 * @returns {{emotion:string|null,text:string}[]}
 */
export function parseEmotionMessage(source, images = [], defaultName = null) {
    const text = String(source ?? '').replace(/\r\n?/g, '\n').trim();
    if (!text) return [];

    const names = new Map(images.map(image => [String(image.name).toLocaleLowerCase(), image.name]));
    let currentEmotion = names.get(String(defaultName ?? '').toLocaleLowerCase()) ?? images[0]?.name ?? null;
    const taggedChunks = [];
    let cursor = 0;
    let match;

    IMAGE_TAG.lastIndex = 0;
    while ((match = IMAGE_TAG.exec(text)) !== null) {
        if (match.index > cursor) {
            taggedChunks.push({ emotion: currentEmotion, text: text.slice(cursor, match.index) });
        }

        const matchedName = names.get(match[1].trim().toLocaleLowerCase());
        if (matchedName) currentEmotion = matchedName;
        cursor = IMAGE_TAG.lastIndex;
    }

    if (cursor < text.length) taggedChunks.push({ emotion: currentEmotion, text: text.slice(cursor) });
    if (!taggedChunks.length) taggedChunks.push({ emotion: currentEmotion, text });

    return taggedChunks.flatMap(chunk => splitParagraphs(chunk.text)
        .map(paragraph => ({ emotion: chunk.emotion, text: paragraph })));
}

function splitParagraphs(text) {
    return String(text)
        .trim()
        .split(/\n\s*\n+/)
        .map(value => value.trim())
        .filter(Boolean);
}

