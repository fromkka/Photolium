import { getBase64Async, saveBase64AsFile } from '../../../utils.js';

const ALLOWED_EXTENSIONS = new Set(['bmp', 'png', 'jpg', 'jpeg', 'jfif', 'webp', 'gif']);

export function assetFolder(profileKey) {
    const compactKey = String(profileKey ?? 'unknown')
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}_-]+/gu, '_')
        .slice(0, 72);
    return `photolium_${compactKey || 'unknown'}`;
}

export async function uploadEmotionFile(file, profileKey) {
    validateImage(file);
    const extension = extensionOf(file.name);
    const name = safeFileName(file.name, extension);
    const base64 = (await getBase64Async(file)).split(',').pop();
    const path = await saveBase64AsFile(base64, assetFolder(profileKey), name.slice(0, -(extension.length + 1)), extension);
    return { name, path, updatedAt: Date.now() };
}

export async function uploadBackgroundFile(file, profileKey) {
    validateImage(file);
    const extension = extensionOf(file.name);
    const base64 = (await getBase64Async(file)).split(',').pop();
    const path = await saveBase64AsFile(base64, assetFolder(profileKey), 'photolium_background', extension);
    return { name: `photolium_background.${extension}`, path, updatedAt: Date.now() };
}

export async function deleteImageFile(path, getRequestHeaders) {
    if (!path) return true;
    const response = await fetch('/api/images/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ path }),
    });
    return response.ok || response.status === 404;
}

export function assetUrl(asset) {
    if (!asset?.path) return '';
    const separator = asset.path.includes('?') ? '&' : '?';
    return `${asset.path}${separator}v=${Number(asset.updatedAt) || 1}`;
}

function validateImage(file) {
    const extension = extensionOf(file?.name);
    if (!(file instanceof File) || !ALLOWED_EXTENSIONS.has(extension)) {
        throw new Error('PNG, JPG, WEBP, GIF, BMP 이미지만 사용할 수 있습니다.');
    }
}

function extensionOf(fileName) {
    return String(fileName ?? '').split('.').pop().toLocaleLowerCase();
}

function safeFileName(fileName, extension) {
    const base = String(fileName)
        .slice(0, -(extension.length + 1))
        .normalize('NFC')
        .replace(/[\[\]<>:"/\\|?*\x00-\x1F]/g, '-')
        .replace(/\s+/g, '_')
        .replace(/^\.+|\.+$/g, '')
        .slice(0, 72) || 'emotion';
    return `${base}.${extension}`;
}

