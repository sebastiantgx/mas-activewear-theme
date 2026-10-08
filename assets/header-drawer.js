import { Component } from '@theme/component';
import { trapFocus, removeTrapFocus } from '@theme/focus';
import { onAnimationEnd, removeWillChangeOnAnimationEnd } from '@theme/utilities';

// Under this width the mobile drawer panel is the one in use; the desktop panel serves the rest
const MOBILE_DRAWER_QUERY = '(max-width: 749px)';
const ACTIVE_PANEL_SELECTOR = '.menu-drawer:not([inert]), .menu-drawer-mobile:not([inert]), .menu-drawer__submenu';

/**
 * A custom element that manages the main menu drawer.
 *
 * @typedef {object} Refs
 * @property {HTMLDetailsElement} details - The details element.
 * @property {HTMLDivElement} menuDrawer - The slideable drawer panel containing the menu.
 *
 * @extends {Component<Refs>}
 */
class HeaderDrawer extends Component {
  requiredRefs = ['details', 'menuDrawer'];

  #mobileQuery = window.matchMedia(MOBILE_DRAWER_QUERY);

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('keyup', this.#onKeyUp);
    this.#setupAnimatedElementListeners();
    this.#syncPanels();
    this.#mobileQuery.addEventListener('change', this.#syncPanels);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keyup', this.#onKeyUp);
    this.#mobileQuery.removeEventListener('change', this.#syncPanels);
  }

  /**
   * The mobile drawer panel and the desktop panel share one <details>. The one that does not apply to the current
   * width is made inert, which takes it out of the accessibility tree and the tab order (display:none alone is not enough
   * while the other panel is animating).
   */
  #syncPanels = () => {
    const mobilePanel = this.querySelector('.menu-drawer-mobile');
    if (!mobilePanel) return;

    const isMobile = this.#mobileQuery.matches;
    this.refs.menuDrawer.toggleAttribute('inert', isMobile);
    mobilePanel.toggleAttribute('inert', !isMobile);
  };

  /**
   * Close the main menu drawer when the Escape key is pressed
   * @param {KeyboardEvent} event
   */
  #onKeyUp = (event) => {
    if (event.key !== 'Escape') return;

    this.#close(this.#getDetailsElement(event));
  };

  /**
   * Lines the mobile panel's header up with the page's top bar: its bottom stroke lands on the same pixel row as the
   * top bar's own, and the logo and close button share the bar's vertical center. The page header moves with the
   * announcement bar and the sticky state, so it is measured each time the drawer opens.
   */
  #alignMobileHeader() {
    const mobilePanel = this.querySelector('.menu-drawer-mobile');
    const bar = document.querySelector('#header-component .header__row--top') ?? document.querySelector('#header-component');
    if (!(mobilePanel instanceof HTMLElement) || !bar) return;

    const { top, bottom } = bar.getBoundingClientRect();
    mobilePanel.style.setProperty('--menu-drawer-mobile-header-height', `${Math.round(bottom)}px`);
    mobilePanel.style.setProperty('--menu-drawer-mobile-header-offset', `${Math.max(0, Math.round(top))}px`);
  }

  /**
   * @returns {boolean} Whether the main menu drawer is open
   */
  get isOpen() {
    return this.refs.details.hasAttribute('open');
  }

  /**
   * Get the closest details element to the event target
   * @param {Event | undefined} event
   * @returns {HTMLDetailsElement}
   */
  #getDetailsElement(event) {
    if (!(event?.target instanceof Element)) return this.refs.details;

    // The accordion inside the mobile drawer is content, not a drawer: Escape there closes the drawer itself
    return event.target.closest('details:not([data-drawer-accordion])') ?? this.refs.details;
  }

  /**
   * Toggle the main menu drawer
   */
  toggle() {
    return this.isOpen ? this.close() : this.open();
  }

  /**
   * Open the closest drawer or the main menu drawer
   * @param {string} [target]
   * @param {Event} [event]
   */
  open(target, event) {
    // A section re-render (hydration) can replace the panels' attributes: apply them again right before opening
    this.#syncPanels();
    this.#alignMobileHeader();

    const details = this.#getDetailsElement(event);
    const summary = details.querySelector('summary');

    if (!summary) return;

    summary.setAttribute('aria-expanded', 'true');

    this.preventInitialAccordionAnimations(details);
    requestAnimationFrame(() => {
      details.classList.add('menu-open');

      if (target) {
        this.refs.menuDrawer.classList.add('menu-drawer--has-submenu-opened');
      }

      // Wait for the drawer animation to complete before trapping focus
      const drawer = details.querySelector(ACTIVE_PANEL_SELECTOR);
      // The mobile panel is a dialog of its own: trap focus inside it (the menu button sits outside the panel)
      const trapTarget = drawer?.classList.contains('menu-drawer-mobile') ? drawer : details;
      onAnimationEnd(drawer || details, () => trapFocus(trapTarget), { subtree: false });
    });
  }

  /**
   * Go back or close the main menu drawer
   * @param {Event} [event]
   */
  back(event) {
    this.#close(this.#getDetailsElement(event));
  }

  /**
   * Close the main menu drawer
   */
  close() {
    this.#close(this.refs.details);
  }

  /**
   * Close the closest menu or submenu that is open
   *
   * @param {HTMLDetailsElement} details
   */
  #close(details) {
    const summary = details.querySelector('summary');

    if (!summary) return;

    summary.setAttribute('aria-expanded', 'false');
    details.classList.remove('menu-open');
    this.refs.menuDrawer.classList.remove('menu-drawer--has-submenu-opened');

    // Wait for the .menu-drawer element's transition, not the entire details subtree
    // This avoids waiting for child accordion/resource-card animations which can cause issues on Firefox
    const drawer = details.querySelector(ACTIVE_PANEL_SELECTOR);
    const isMobilePanel = Boolean(drawer?.classList.contains('menu-drawer-mobile'));

    onAnimationEnd(
      drawer || details,
      () => {
        reset(details);
        if (details === this.refs.details) {
          removeTrapFocus();
          const openDetails = this.querySelectorAll('details[open]:not(accordion-custom > details)');
          openDetails.forEach(reset);
          // Back to the button that opened the drawer
          if (isMobilePanel) summary.focus();
        } else {
          trapFocus(this.refs.details);
        }
      },
      { subtree: false }
    );
  }

  /**
   * Attach animationend event listeners to all animated elements to remove will-change after animation
   * to remove the stacking context and allow submenus to be positioned correctly
   */
  #setupAnimatedElementListeners() {
    const allAnimated = this.querySelectorAll('.menu-drawer__animated-element');
    allAnimated.forEach((element) => {
      element.addEventListener('animationend', removeWillChangeOnAnimationEnd);
    });
  }

  /**
   * Temporarily disables accordion animations to prevent unwanted transitions when the drawer opens.
   * Adds a no-animation class to accordion content elements, then removes it after 100ms to
   * re-enable animations for user interactions.
   * @param {HTMLDetailsElement} details - The details element containing the accordions
   */
  preventInitialAccordionAnimations(details) {
    const content = details.querySelectorAll('accordion-custom .details-content');

    content.forEach((element) => {
      if (element instanceof HTMLElement) {
        element.classList.add('details-content--no-animation');
      }
    });
    setTimeout(() => {
      content.forEach((element) => {
        if (element instanceof HTMLElement) {
          element.classList.remove('details-content--no-animation');
        }
      });
    }, 100);
  }
}

if (!customElements.get('header-drawer')) {
  customElements.define('header-drawer', HeaderDrawer);
}

/**
 * Reset an open details element to its original state
 *
 * @param {HTMLDetailsElement} element
 */
function reset(element) {
  element.classList.remove('menu-open');
  element.removeAttribute('open');
  element.querySelector('summary')?.setAttribute('aria-expanded', 'false');
}
