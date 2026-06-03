/**
 * @file script.js
 *
 * Front-end behaviour for the page: contact form handling (validation,
 * persistence, submission, success/cooldown handling), the mobile navigation
 * overlay, and smooth-scroll navigation between sections.
 */

/** @type {HTMLFormElement} */
const contactForm = document.getElementById('contact-form');

/** @type {NodeListOf<HTMLInputElement|HTMLTextAreaElement>} */
const fields = document.querySelectorAll('.form-field input, .form-field textarea');

/** @type {HTMLInputElement} */
const submitBtn = document.getElementById('submit-form');

/** @type {HTMLInputElement} */
const checkbox = document.getElementById('accept-privacy-policy');

/** @type {HTMLElement} */
const formErrors = document.getElementById('form-errors');

/** @type {HTMLElement} */
const formSuccess = document.getElementById('form-success');

/** @type {HTMLElement} */
const footerYear = document.getElementById('footer-year');

/** @type {Date} */
const date = new Date();

/**
 * Prefix used for all sessionStorage keys written by the contact form.
 * @type {string}
 */
const STORAGE_PREFIX = 'contactForm_';

/**
 * Number of seconds the submit button stays disabled after a successful send.
 * @type {number}
 */
const COOLDOWN_SECONDS = 30;

/**
 * Active cooldown interval handle, or `null` when no cooldown is running.
 * @type {?number}
 */
let cooldownInterval = null;

/**
 * Translate a key via the global `t` helper if available, otherwise return the
 * provided fallback string.
 *
 * @param {string} key - Translation key to look up.
 * @param {string} fallback - String returned when no translation is found.
 * @returns {string} The translated string or the fallback.
 */
const tx = (key, fallback) => (typeof t === 'function' && t(key)) || fallback;

/**
 * Maps the (German) error strings returned by the mailer backend onto
 * language-neutral i18n keys, so the displayed message follows the active page
 * language instead of the backend's wording.
 *
 * The backend always responds with HTTP 200, so the only distinguishing
 * information is the `error` string itself — hence the string-keyed lookup.
 * Keys are looked up after trimming, because some backend strings carry
 * trailing whitespace (e.g. the rate-limit message).
 *
 * @type {Object<string, string>}
 */
const BACKEND_ERROR_MAP = {
    'Konfiguration nicht gefunden.':                          'contact.errors.configMissing',
    'Methode nicht erlaubt.':                                 'contact.errors.methodNotAllowed',
    'Bitte warte einen Moment, bevor du erneut sendest.':     'contact.errors.rateLimit',
    'Name zu kurz.':                                          'contact.errors.nameShort',
    'Name zu lang.':                                          'contact.errors.nameLong',
    'E-Mail fehlt.':                                          'contact.errors.emailMissing',
    'E-Mail-Adresse zu lang.':                                'contact.errors.emailLong',
    'Ungültige E-Mail-Adresse.':                              'contact.errors.emailInvalid',
    'Betreff zu kurz.':                                       'contact.errors.subjectShort',
    'Betreff zu lang.':                                       'contact.errors.subjectLong',
    'Nachricht zu kurz.':                                     'contact.errors.messageShort',
    'Nachricht zu lang.':                                     'contact.errors.messageLong',
    'Ungültige Telefonnummer.':                               'contact.errors.phoneInvalid',
    'Captcha fehlt.':                                         'contact.errors.captchaMissing',
    'Captcha-Verifikation nicht erreichbar.':                 'contact.errors.captchaUnreachable',
    'Captcha-Prüfung fehlgeschlagen.':                        'contact.errors.captchaFailed',
    'Versand fehlgeschlagen. Bitte später erneut versuchen.': 'contact.errors.sendFailed',
};

/**
 * Translate a backend error string into a localized message. Falls back to a
 * generic localized message (and logs a console warning) for any string not
 * present in {@link BACKEND_ERROR_MAP}.
 *
 * @param {string} [backendMsg] - The raw `error` string from the backend.
 * @returns {string} A localized, user-facing error message.
 */
function mapBackendError(backendMsg) {
    const key = BACKEND_ERROR_MAP[(backendMsg || '').trim()];
    if (key) return tx(key, backendMsg);
    console.warn('[form] unmapped backend error:', backendMsg);
    return tx('contact.errors.generic', backendMsg || 'Something went wrong.');
}

/**
 * Raw backend error strings for which NO cooldown should be started. The mailer
 * rejects these BEFORE it writes its rate-limit timestamp (the config and
 * method checks run ahead of the rate-limit logic), so no server-side timer is
 * ticking and an immediate retry is legitimate. Every other outcome — all
 * validation/captcha/send errors and success — happens AFTER the timestamp is
 * written, meaning the 30s rate window is already running and the button must
 * lock to match it.
 *
 * @type {Set<string>}
 */
const NO_COOLDOWN_ERRORS = new Set([
    'Konfiguration nicht gefunden.',
    'Methode nicht erlaubt.',
]);

/**
 * Current page path, used to skip section-scroll wiring on legal pages.
 * @type {string}
 */
const path = window.location.pathname;

/**
 * Paths considered legal pages, where the main-page section scrolling is absent.
 * @type {string[]}
 */
const legalPaths = [
  "/privacy.html",
  "privacy.html",
  "/legal.html",
  "legal.html",
  "/imprint.html",
  "imprint.html",
];

/**
 * Initialise the page: set the footer year, restore persisted form data and
 * update the submit button state.
 *
 * @returns {void}
 */
function init() {
    footerYear.innerText = date.getFullYear();
    restoreFormData();
    updateSubmitButton();
}

/**
 * Restore any field values previously saved in sessionStorage and trigger the
 * input event so dependent UI (labels, validation) updates accordingly.
 *
 * @returns {void}
 */
function restoreFormData() {
    fields.forEach(field => {
        const saved = sessionStorage.getItem(STORAGE_PREFIX + field.name);
        if (saved !== null) {
            field.value = saved;
            field.dispatchEvent(new Event('input'));
        }
    });
}

/**
 * Persist a single field's value to sessionStorage, removing the entry when the
 * trimmed value is empty.
 *
 * @param {(HTMLInputElement|HTMLTextAreaElement)} field - The field to save.
 * @returns {void}
 */
function saveField(field) {
    const value = field.value.trim();
    if (value === '') {
        sessionStorage.removeItem(STORAGE_PREFIX + field.name);
    } else {
        sessionStorage.setItem(STORAGE_PREFIX + field.name, field.value);
    }
}

/**
 * Remove all contact-form values (including the accept entry) from
 * sessionStorage.
 *
 * @returns {void}
 */
function clearFormStorage() {
    fields.forEach(field => sessionStorage.removeItem(STORAGE_PREFIX + field.name));
    sessionStorage.removeItem(STORAGE_PREFIX + 'accept');
}

/**
 * Enable or disable the submit button based on field validity and the privacy
 * checkbox. No-op while a cooldown is active.
 *
 * @returns {void}
 */
function updateSubmitButton() {
    if (cooldownInterval) return;
    const allFieldsValid = Array.from(fields).every(f =>
        f.value.trim() !== '' && f.checkValidity()
    );
    if (allFieldsValid && checkbox.checked) {
        submitBtn.classList.remove('disabled');
    } else {
        submitBtn.classList.add('disabled');
    }
}

/**
 * Validate a field, toggling the `is-invalid` state on its wrapper, then update
 * the submit button and persist the value.
 *
 * @param {(HTMLInputElement|HTMLTextAreaElement)} field - The field to validate.
 * @returns {void}
 */
function validateField(field) {
    const wrapper = field.closest('.form-field');
    wrapper.classList.remove('is-valid', 'is-invalid');
    if (field.value.trim() === '') {
        if (field.required) wrapper.classList.add('is-invalid');
    } else if (!field.checkValidity()) {
        wrapper.classList.add('is-invalid');
    }
    updateSubmitButton();
    saveField(field);
}

/**
 * Show a form-level message, hiding any previously shown messages first.
 *
 * @param {('error'|'success')} type - Which message to display.
 * @param {string} [text] - Message text. For success, omit to keep the markup default.
 * @returns {void}
 */
function showFormMessage(type, text) {
    hideFormMessages();
    if (type === 'error') {
        formErrors.textContent = text;
        formErrors.removeAttribute('hidden');
    } else if (type === 'success') {
        if (text) formSuccess.textContent = text;
        formSuccess.removeAttribute('hidden');
    }
}

/**
 * Hide and clear both the error and success form messages.
 *
 * @returns {void}
 */
function hideFormMessages() {
    formErrors.setAttribute('hidden', '');
    formErrors.textContent = '';
    formSuccess.setAttribute('hidden', '');
}

/**
 * Reset the hCaptcha widget, if the hCaptcha library is present.
 *
 * @returns {void}
 */
function resetCaptcha() {
    if (typeof hcaptcha !== 'undefined') hcaptcha.reset();
}

/**
 * Display a handled backend error, reset the captcha and start the cooldown
 * unless the mailer rejected the request before stamping its rate timer.
 *
 * @param {{success: boolean, error?: string}} result - The parsed backend response.
 * @returns {void}
 */
function handleBackendError(result) {
    showFormMessage('error', mapBackendError(result.error));
    resetCaptcha();
    if (!NO_COOLDOWN_ERRORS.has((result.error || '').trim())) startCooldown();
}

/**
 * Restore the submit button to its default disabled/idle state, unless a
 * cooldown is currently counting down.
 *
 * @returns {void}
 */
function restoreSubmitButton() {
    if (cooldownInterval) return;
    submitBtn.classList.add('disabled');
    submitBtn.value = tx('contact.submit', 'Send message');
}

/**
 * Handle the submit click: prevent default submission, send the form data and
 * delegate to the success or backend-error handler. Network and parse errors
 * are surfaced as a message with the captcha reset; the button state is
 * restored in all cases unless a cooldown has started.
 *
 * @param {Event} e - The triggering click/submit event.
 * @returns {Promise<void>}
 */
async function submitForm(e) {
    e.preventDefault();
    if (submitBtn.classList.contains('disabled')) return;
    hideFormMessages();
    submitBtn.value = tx('contact.sending', 'Sending...');
    try {
        const result = await sendFormData();
        if (result.success) handleSuccess();
        else handleBackendError(result);
    } catch (err) {
        showFormMessage('error', err.message || String(err));
        resetCaptcha();
    } finally {
        restoreSubmitButton();
    }
}

/**
 * Submit the contact form via fetch and parse the JSON response.
 *
 * @returns {Promise<{success: boolean, error?: string}>} The parsed backend response.
 */
async function sendFormData() {
    const response = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'fetch' },
    });
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(tx('contact.errors.generic', 'Server error. Please try again later.'));
    }
}

/**
 * Handle a successful submission: reset all fields and the captcha, show the
 * success message, clear persisted data and start the cooldown.
 *
 * @returns {void}
 */
function handleSuccess() {
    contactForm.querySelectorAll('input, textarea').forEach(resetField);
    resetCaptcha();
    showFormMessage('success');
    clearFormStorage();
    startCooldown();
}

/**
 * Reset a single form control to its empty/unchecked state and clear its
 * validation styling. Submit buttons are left untouched.
 *
 * @param {HTMLElement} f - The form control to reset.
 * @returns {void}
 */
function resetField(f) {
    if (f.type === 'checkbox') f.checked = false;
    else if (f.type !== 'submit') f.value = '';
    f.closest('.form-field')?.classList.remove('is-valid', 'is-invalid');
}

if (!legalPaths.includes(path)) {
    document.querySelector('#to-skills button').addEventListener('click', () => {
        document.getElementById('skills').scrollIntoView({ behavior: 'smooth' });
    });

    document.querySelector('#to-portfolio button').addEventListener('click', () => {
        document.getElementById('portfolio').scrollIntoView({ behavior: 'smooth' });
    });

    document.querySelector('#to-contact button').addEventListener('click', () => {
        document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    });
}

fields.forEach(field => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => validateField(field));
});

checkbox.addEventListener('change', updateSubmitButton);
submitBtn.addEventListener('click', submitForm);

/**
 * Set the submit button label to the localized cooldown text for the given
 * number of seconds remaining.
 *
 * @param {number} seconds - Seconds left in the cooldown.
 * @returns {void}
 */
function setCooldownLabel(seconds) {
    submitBtn.value = tx('contact.cooldown', `Wait ${seconds}s...`).replace('{seconds}', seconds);
}

/**
 * Start the post-submit cooldown: disable the button and count down the
 * remaining seconds, restoring the submit label and re-evaluating button state
 * when it finishes.
 *
 * @returns {void}
 */
function startCooldown() {
    let remaining = COOLDOWN_SECONDS;
    submitBtn.classList.add('disabled');
    setCooldownLabel(remaining);
    cooldownInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            submitBtn.value = tx('contact.submit', 'Send message');
            updateSubmitButton();
        } else {
            setCooldownLabel(remaining);
        }
    }, 1000);
}

/**
 * Toggle the mobile navigation overlay open/closed, lock or unlock body scroll
 * and update the related ARIA attributes.
 *
 * @returns {void}
 */
function openNavbar() {
    const isOpen = document.body.classList.toggle('menu-open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
    const toggle = document.getElementById('nav-toggle');
    const overlay = document.getElementById('nav-overlay');
    if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
    if (overlay) overlay.setAttribute('aria-hidden', String(!isOpen));
}

/**
 * Close the mobile navigation overlay, unlock body scroll and reset the related
 * ARIA attributes.
 *
 * @returns {void}
 */
function closeNavbar() {
    document.body.classList.remove('menu-open');
    document.body.style.overflow = '';
    const toggle = document.getElementById('nav-toggle');
    const overlay = document.getElementById('nav-overlay');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (overlay) overlay.setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('#nav-overlay-menu .nav-overlay-link').forEach(link => {
    link.addEventListener('click', closeNavbar);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
        closeNavbar();
    }
});

document.querySelectorAll('.arrow-to-next-section').forEach(section => {
    const arrow = section.querySelector('.go-to-next-section');
    section.addEventListener('mouseenter', () => arrow.classList.add('revealed'), { once: true });
});