/* ============================================================
   early-lang.js – sets <html lang> before the browser decides
   ============================================================
   MUST be loaded synchronously in the <head> (no defer/async)
   and BEFORE any rendering happens. Mirrors the detection
   logic in i18n.js so the browser sees the correct language
   from the very first paint — preventing the "translate this
   page?" prompt when the user has German preferences.
   ============================================================ */
(function () {
    try {
        var supported = ['de', 'en'];
        var saved = localStorage.getItem('lang');
        var browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
        var lang = supported.indexOf(saved) !== -1 ? saved
                 : supported.indexOf(browser) !== -1 ? browser
                 : 'en';
        document.documentElement.lang = lang;
    } catch (e) { /* localStorage blocked – fall back to default */ }
})();
