/**
 * @file i18n.js
 *
 * Simple client-side translation helper.
 *
 * Supports three attribute styles on DOM elements:
 *
 * 1. `data-i18n="key.path"` — replaces `element.textContent`.
 * 2. `data-i18n-html="key.path"` — replaces `element.innerHTML` (use for
 *    translations that contain inline HTML such as `<br>` or `<a>`).
 * 3. `data-i18n-attr="placeholder:key.path, title:key.other"` — replaces one or
 *    more attributes (comma-separated).
 *
 * Public API exposed on `window`:
 * - {@link switchLanguage} — load and apply a language.
 * - {@link getCurrentLanguage} — return the active language code.
 * - {@link t} — look up a translation in JS.
 */

/**
 * Global i18n state container.
 *
 * @type {{
 *   supported: string[],
 *   fallback: string,
 *   translations: Object,
 *   current: (string|null)
 * }}
 */
const I18N = {
    supported: ['de', 'en'],
    fallback: 'en',
    translations: {},
    current: null,
};

/**
 * Id of the currently rendered hCaptcha widget, or `null` if none is rendered.
 *
 * @type {?number}
 */
let captchaId = null;

/**
 * Resolve a dotted key path (e.g. `"contact.submit"`) against the loaded
 * translations object.
 *
 * @param {string} key - Dot-separated path into the translations object.
 * @returns {*} The translated value, or `undefined` if the path does not exist.
 */
function t(key) {
    return key.split('.').reduce((obj, k) => (obj == null ? obj : obj[k]), I18N.translations);
}

/**
 * Get the currently active language code.
 *
 * @returns {('de'|'en'|null)} The active language, or `null` if none is loaded yet.
 */
function getCurrentLanguage() {
    return I18N.current;
}

/**
 * Detect the initial language using the priority order:
 * `localStorage` → `<html lang>` → browser language → fallback.
 *
 * @returns {string} A supported language code.
 */
function detectInitialLanguage() {
    const saved = localStorage.getItem('lang');
    if (saved && I18N.supported.includes(saved)) return saved;

    const htmlLang = document.documentElement.lang?.slice(0, 2);
    if (htmlLang && I18N.supported.includes(htmlLang)) return htmlLang;

    const browser = (navigator.language || 'en').slice(0, 2);
    if (I18N.supported.includes(browser)) return browser;

    return I18N.fallback;
}

/**
 * Apply translations to every element within the given root that carries an
 * i18n attribute. Handles `data-i18n` (textContent), `data-i18n-html`
 * (innerHTML), `data-i18n-attr` (one or more attributes) and the document
 * `<title>` via a `data-i18n-title` attribute on the root element.
 *
 * @param {(Document|Element)} [root=document] - Subtree within which to apply translations.
 * @returns {void}
 */
function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        const value = t(el.getAttribute('data-i18n'));
        if (value != null) el.textContent = value;
    });

    root.querySelectorAll('[data-i18n-html]').forEach(el => {
        const value = t(el.getAttribute('data-i18n-html'));
        if (value != null) el.innerHTML = value;
    });

    root.querySelectorAll('[data-i18n-attr]').forEach(el => {
        el.getAttribute('data-i18n-attr').split(',').forEach(pair => {
            const [attr, key] = pair.split(':').map(s => s.trim());
            const value = t(key);
            if (value != null && attr) el.setAttribute(attr, value);
        });
    });

    const titleKey = document.documentElement.getAttribute('data-i18n-title');
    if (titleKey) {
        const value = t(titleKey);
        if (value != null) document.title = value;
    }
}

/**
 * Update the visual selected state of the language switcher buttons.
 *
 * @param {string} lang - The language code that should appear selected.
 * @returns {void}
 */
function updateSwitcherUI(lang) {
    document.querySelectorAll('.lang-switch-option').forEach(opt => {
        const isActive = opt.textContent.trim().toLowerCase() === lang;
        opt.classList.toggle('selected', isActive);
    });
}

/**
 * Load a language file, persist the choice, apply translations and notify other
 * scripts via a `languagechange` event. Falls back to the default language for
 * unsupported codes and returns early if loading fails. Exposed globally as
 * `window.switchLanguage`.
 *
 * @param {string} lang - The language code to switch to.
 * @returns {Promise<void>} Resolves once translations have been applied.
 */
async function switchLanguage(lang) {
    if (!I18N.supported.includes(lang)) lang = I18N.fallback;

    try {
        const res = await fetch(`./assets/i18n/${lang}.json`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        I18N.translations = await res.json();
    } catch (err) {
        console.error('[i18n] failed to load', lang, err);
        return;
    }

    I18N.current = lang;
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);

    applyTranslations();
    updateSwitcherUI(lang);

    document.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
    renderCaptcha(detectInitialLanguage());
}

document.addEventListener('DOMContentLoaded', () => {
    switchLanguage(detectInitialLanguage());
});

window.switchLanguage = switchLanguage;
window.getCurrentLanguage = getCurrentLanguage;
window.t = t;

/**
 * Render (or re-render) the hCaptcha widget in the given language, removing any
 * previously rendered instance first.
 *
 * No-op if the page has no captcha container or if the hCaptcha library has not
 * loaded yet; in the latter case the initial render is handled by
 * {@link onHcaptchaLoad} once the library is ready.
 *
 * @param {string} lang - Language code passed to hCaptcha's `hl` option.
 * @returns {void}
 */
function renderCaptcha(lang) {
    const captchaContainer = document.getElementById('hcaptcha-container');
    // Abbrechen, wenn es keinen Container gibt oder hCaptcha noch nicht geladen ist
    if (!captchaContainer || typeof hcaptcha === 'undefined') return;

    if (captchaId !== null) {
        hcaptcha.remove(captchaId);
    }
    captchaId = hcaptcha.render(captchaContainer, {
        sitekey: 'ebba1710-83a6-4e3e-b424-677cc038ed60',
        hl: lang,
        size: 'compact'
    });
}

/**
 * hCaptcha `onload` callback. Renders the widget using the detected initial
 * language.
 *
 * @returns {void}
 */
function onHcaptchaLoad() {
    renderCaptcha(detectInitialLanguage());
}