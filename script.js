const contactForm = document.getElementById('contact-form');
const fields = document.querySelectorAll('.form-field input, .form-field textarea');
const submitBtn = document.getElementById('submit-form');
const checkbox = document.getElementById('accept-privacy-policy');
const formErrors = document.getElementById('form-errors');
const formSuccess = document.getElementById('form-success');
const footerYear = document.getElementById('footer-year');

const date = new Date();

const STORAGE_PREFIX = 'contactForm_';

const COOLDOWN_SECONDS = 30;
let cooldownInterval = null;

const tx = (key, fallback) => (typeof t === 'function' && t(key)) || fallback;

const path = window.location.pathname;
const legalPaths = [
  "/privacy.html",
  "privacy.html",
  "/legal.html",
  "legal.html",
  "/imprint.html",
  "imprint.html",
];

function init() {
    footerYear.innerText = date.getFullYear();
    restoreFormData();
    updateSubmitButton();
}

function restoreFormData() {
    fields.forEach(field => {
        const saved = sessionStorage.getItem(STORAGE_PREFIX + field.name);
        if (saved !== null) {
            field.value = saved;
            field.dispatchEvent(new Event('input'));
        }
    });
}

function saveField(field) {
    const value = field.value.trim();
    if (value === '') {
        sessionStorage.removeItem(STORAGE_PREFIX + field.name);
    } else {
        sessionStorage.setItem(STORAGE_PREFIX + field.name, field.value);
    }
}

function clearFormStorage() {
    fields.forEach(field => sessionStorage.removeItem(STORAGE_PREFIX + field.name));
    sessionStorage.removeItem(STORAGE_PREFIX + 'accept');
}

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

function hideFormMessages() {
    formErrors.setAttribute('hidden', '');
    formErrors.textContent = '';
    formSuccess.setAttribute('hidden', '');
}

async function submitForm(e) {
    e.preventDefault();
    if (submitBtn.classList.contains('disabled')) return;
    e.preventDefault();
    hideFormMessages();
    submitBtn.value = tx('contact.sending', 'Sending...');
    try {
        const result = await sendFormData();
        if (!result.success) throw new Error(result.error || 'Versand fehlgeschlagen.');
        handleSuccess();
    } catch (err) {
        showFormMessage('error', err.message || String(err));
        if (typeof hcaptcha !== 'undefined') hcaptcha.reset();
    } finally {
        if (!cooldownInterval) {
            submitBtn.classList.add('disabled');
            submitBtn.value = tx('contact.submit', 'Send message');
        }
    }
}

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
        if (!result.success) {
            currentError = { backend: result.error };
            throw new Error(mapBackendError(result.error));
        }
    }
}

function handleSuccess() {
    contactForm.querySelectorAll('input, textarea').forEach(resetField);
    if (typeof hcaptcha !== 'undefined') hcaptcha.reset();
    showFormMessage('success');
    clearFormStorage();
    startCooldown();
}

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

function startCooldown() {
    let remaining = COOLDOWN_SECONDS;
    submitBtn.classList.add('disabled');
    submitBtn.value = tx('contact.cooldown', `Wait ${remaining}s...`).replace('{seconds}', remaining);

    cooldownInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            submitBtn.value = tx('contact.submit', 'Send message');
            updateSubmitButton();
        } else {
            submitBtn.value = tx('contact.cooldown', `Wait ${remaining}s...`).replace('{seconds}', remaining);
        }
    }, 1000);
}

function openNavbar() {
    const isOpen = document.body.classList.toggle('menu-open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
    const toggle = document.getElementById('nav-toggle');
    const overlay = document.getElementById('nav-overlay');
    if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
    if (overlay) overlay.setAttribute('aria-hidden', String(!isOpen));
}

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