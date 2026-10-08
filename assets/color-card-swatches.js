/**
 * Swatches of the per-color product cards (snippets/product-color-cards.liquid).
 *
 * - Mouse: hovering a swatch previews that color on its card (image, title, price, ring, badge); leaving the row reverts.
 *   Clicking navigates to the product page of that color (the swatch is a plain link).
 * - Keyboard: focusing a swatch previews it, Enter follows the link.
 * - Touch: tapping a swatch selects that color on the card without navigating (aria-pressed). The card's three links
 *   point to the selected color, so tapping the image or the title opens its product page.
 *
 * Events are delegated on the document so cards appended by infinite scroll, replaced by filters or placed in a
 * carousel work without any setup. The data comes from the data-sw-* attributes of each swatch.
 */

const ROW = '.color-card__swatches';
const SWATCH = '.color-card__swatch';
const CURRENT = 'color-card__swatch--current';
const CARD_LINKS = 'a.product-card__link, a[ref="cardGalleryLink"], a[ref="productTitleLink"]';

/** The color a row returns to when a preview ends: the card's own color, or the last one selected by touch. */
const baseSwatches = new WeakMap();
let lastInput = 'mouse';

/** @param {Element} row */
function getBase(row) {
  let base = baseSwatches.get(row);
  if (!base || !row.contains(base)) {
    base = row.querySelector(`.${CURRENT}`) ?? undefined;
    if (base) baseSwatches.set(row, base);
  }
  return base;
}

/** Warms the images of the whole row the first time it is used, with the sizes the card's image uses. */
function preload(/** @type {Element} */ row) {
  if (row instanceof HTMLElement === false || row.dataset.swPreloaded) return;
  row.dataset.swPreloaded = 'true';
  const sizes = row.closest('product-card')?.querySelector('img.product-media__image')?.sizes;
  for (const swatch of row.querySelectorAll(SWATCH)) {
    if (!(swatch instanceof HTMLElement)) continue;
    const image = new Image();
    if (sizes) image.sizes = sizes;
    image.srcset = swatch.dataset.swSrcset ?? '';
    image.src = swatch.dataset.swSrc ?? '';
  }
}

/**
 * @param {Element} card
 * @param {HTMLElement} row
 * @param {string} state - 'sold-out', 'sale' or ''
 */
function setBadge(card, row, state) {
  const gallery = card.querySelector('.card-gallery');
  if (!gallery) return;
  const position = row.dataset.badgePosition;
  let badges = gallery.querySelector('.product-badges');

  if (!state) {
    badges?.remove();
    gallery.classList.remove(`card-gallery--badge-${position}`);
    return;
  }

  if (!badges) {
    badges = document.createElement('div');
    badges.className = `product-badges product-badges--${position}`;
    badges.setAttribute('style', row.dataset.badgeStyle ?? '');
    const badge = document.createElement('div');
    badge.className = 'product-badges__badge product-badges__badge--rectangle';
    badges.append(badge);
    gallery.append(badges);
  }

  const badge = badges.querySelector('.product-badges__badge');
  if (!badge) return;
  badge.classList.toggle('color-custom-badge-sold-out', state === 'sold-out');
  badge.classList.toggle('color-custom-badge-sale', state !== 'sold-out');
  badge.textContent = state === 'sold-out' ? (row.dataset.badgeSoldOut ?? '') : (row.dataset.badgeSale ?? '');
  gallery.classList.add(`card-gallery--badge-${position}`);
}

/**
 * Shows the color of a swatch on its card. The card keeps its size: only image source, texts and badge change.
 * @param {HTMLElement} swatch
 */
function show(swatch) {
  const row = swatch.closest(ROW);
  const card = row?.closest('product-card');
  if (!(row instanceof HTMLElement) || !card) return;
  const data = swatch.dataset;

  const image = card.querySelector('.card-gallery img.product-media__image');
  if (image instanceof HTMLImageElement) {
    image.srcset = data.swSrcset ?? '';
    image.src = data.swSrc ?? '';
    image.alt = data.swAlt ?? '';
  }

  for (const title of card.querySelectorAll('.product-grid-view-zoom-out--details, .color-card__title p')) {
    title.textContent = data.swLabel ?? '';
  }

  const price = card.querySelector('.color-card__price .price');
  if (price) {
    const nodes = [];
    if (data.swCompare) {
      const compare = document.createElement('s');
      compare.textContent = data.swCompare;
      nodes.push(compare);
    }
    nodes.push(document.createTextNode(data.swPrice ?? ''));
    price.replaceChildren(...nodes);
  }

  for (const other of row.querySelectorAll(SWATCH)) {
    const isCurrent = other === swatch;
    other.classList.toggle(CURRENT, isCurrent);
    if (isCurrent) other.setAttribute('aria-current', 'true');
    else other.removeAttribute('aria-current');
  }

  setBadge(card, row, data.swState ?? '');
}

/**
 * Makes the color permanent on the card (touch): same as show, plus links, accessible names and pressed state.
 * @param {HTMLElement} swatch
 */
function select(swatch) {
  const row = swatch.closest(ROW);
  const card = row?.closest('product-card');
  if (!(row instanceof HTMLElement) || !card) return;

  show(swatch);
  baseSwatches.set(row, swatch);

  for (const link of card.querySelectorAll(CARD_LINKS)) {
    if (!(link instanceof HTMLAnchorElement)) continue;
    const url = new URL(link.getAttribute('href') ?? '', window.location.href);
    url.searchParams.set('variant', swatch.dataset.swVariant ?? '');
    link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
    if (link.hasAttribute('aria-label')) link.setAttribute('aria-label', swatch.dataset.swLabel ?? '');
  }

  for (const other of row.querySelectorAll(SWATCH)) {
    other.setAttribute('aria-pressed', String(other === swatch));
  }
}

/** @param {Element} row */
function revert(row) {
  const base = getBase(row);
  if (base instanceof HTMLElement) show(base);
}

/** @param {EventTarget | null} target */
function swatchOf(target) {
  const swatch = target instanceof Element ? target.closest(SWATCH) : null;
  return swatch instanceof HTMLElement && swatch.closest(ROW) ? swatch : null;
}

/** @param {EventTarget | null} target */
function rowOf(target) {
  return target instanceof Element ? target.closest(ROW) : null;
}

document.addEventListener('pointerdown', (event) => (lastInput = event.pointerType), true);
document.addEventListener('keydown', () => (lastInput = 'keyboard'), true);

document.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse') return;
  const swatch = swatchOf(event.target);
  if (!swatch) return;
  const row = rowOf(swatch);
  if (!row) return;
  getBase(row);
  preload(row);
  show(swatch);
});

document.addEventListener('pointerout', (event) => {
  if (event.pointerType !== 'mouse') return;
  const row = rowOf(event.target);
  if (!row || (event.relatedTarget instanceof Node && row.contains(event.relatedTarget))) return;
  revert(row);
});

document.addEventListener('focusin', (event) => {
  const swatch = swatchOf(event.target);
  if (!swatch || !swatch.matches(':focus-visible')) return;
  const row = rowOf(swatch);
  if (!row) return;
  getBase(row);
  preload(row);
  show(swatch);
});

document.addEventListener('focusout', (event) => {
  const row = rowOf(event.target);
  if (!row || !swatchOf(event.target) || (event.relatedTarget instanceof Node && row.contains(event.relatedTarget))) {
    return;
  }
  revert(row);
});

document.addEventListener('click', (event) => {
  const swatch = swatchOf(event.target);
  if (!swatch || (lastInput !== 'touch' && lastInput !== 'pen')) return;
  event.preventDefault();
  const row = rowOf(swatch);
  if (row) {
    getBase(row);
    preload(row);
  }
  select(swatch);
});
