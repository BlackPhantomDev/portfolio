/**
 * @file early-lang.js
 *
 * Sets the document's `lang` attribute before the browser's first paint, so the
 * browser sees the correct language from the very first render. This prevents
 * the browser's "translate this page?" prompt from appearing for users whose
 * preferred language already matches the page.
 *
 * Must be loaded synchronously in the `<head>` (no `defer`/`async`) and before
 * any rendering happens. The detection logic mirrors {@link detectInitialLanguage}
 * in i18n.js. If `localStorage` is unavailable, the document language is left
 * untouched and the default applies.
 */
(function () {
    try {
        var supported = ['de', 'en'];
        var saved = localStorage.getItem('lang');
        var browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
        var lang = supported.indexOf(saved) !== -1 ? saved
                 : supported.indexOf(browser) !== -1 ? browser
                 : 'en';
        document.documentElement.lang = lang;
    } catch (e) {
        /* no-op */
    }
})();