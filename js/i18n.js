/* ============================================================
   i18n.js – simple client-side translation helper
   ============================================================
   Supports three attribute styles:

   1) data-i18n="key.path"
      → replaces element.textContent

   2) data-i18n-html="key.path"
      → replaces element.innerHTML (use for translations
        that contain inline HTML like <br> or <a>)

   3) data-i18n-attr="placeholder:key.path, title:key.other"
      → replaces one or more attributes (comma-separated)

   Public API:
      switchLanguage(lang)   – load + apply a language
      getCurrentLanguage()   – returns 'de' | 'en'
      t(key)                 – lookup a translation in JS
   ============================================================ */

const I18N = {
    supported: ['de', 'en'],
    fallback: 'en',
    translations: {},
    current: null,
};

/**
 * Resolve a dotted key path against the loaded translations.
 * Returns undefined if not found.
 */
function t(key) {
    return key.split('.').reduce((obj, k) => (obj == null ? obj : obj[k]), I18N.translations);
}

function getCurrentLanguage() {
    return I18N.current;
}

/**
 * Detect initial language: localStorage → <html lang> → browser → fallback
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
 * Apply translations to the entire DOM.
 */
function applyTranslations(root = document) {
    // textContent
    root.querySelectorAll('[data-i18n]').forEach(el => {
        const value = t(el.getAttribute('data-i18n'));
        if (value != null) el.textContent = value;
    });

    // innerHTML (for translations containing inline markup)
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
        const value = t(el.getAttribute('data-i18n-html'));
        if (value != null) el.innerHTML = value;
    });

    // attribute translations: "attr:key, attr:key"
    root.querySelectorAll('[data-i18n-attr]').forEach(el => {
        el.getAttribute('data-i18n-attr').split(',').forEach(pair => {
            const [attr, key] = pair.split(':').map(s => s.trim());
            const value = t(key);
            if (value != null && attr) el.setAttribute(attr, value);
        });
    });

    // <title> tag
    const titleKey = document.documentElement.getAttribute('data-i18n-title');
    if (titleKey) {
        const value = t(titleKey);
        if (value != null) document.title = value;
    }
}

/**
 * Update the visual state of the language switcher.
 */
function updateSwitcherUI(lang) {
    document.querySelectorAll('.lang-switch-option').forEach(opt => {
        const isActive = opt.textContent.trim().toLowerCase() === lang;
        opt.classList.toggle('selected', isActive);
    });
}

/**
 * Load a language file and apply it. Exposed globally.
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

    // Let other scripts react (e.g. for re-rendering dynamic content)
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
    switchLanguage(detectInitialLanguage());
});

// Expose for inline onclick handlers and other scripts
window.switchLanguage = switchLanguage;
window.getCurrentLanguage = getCurrentLanguage;
window.t = t;
