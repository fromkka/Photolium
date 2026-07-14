export function findNeutralImage(images = []) {
    return images.find(image => {
        const stem = String(image?.name ?? '').replace(/\.[^.]+$/, '').toLocaleLowerCase();
        return /^(neutral|default|normal|뉴트럴|네츄럴|중립|기본)$/.test(stem);
    }) ?? null;
}
