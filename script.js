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
    submitBtn.value = 'Sending...';
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
            submitBtn.value = 'Send message';
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

document.querySelector('#to-contact button').addEventListener('click', () => {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
});

fields.forEach(field => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => validateField(field));
});

checkbox.addEventListener('change', updateSubmitButton);
submitBtn.addEventListener('click', submitForm);

function startCooldown() {
    let remaining = COOLDOWN_SECONDS;
    submitBtn.classList.add('disabled');
    submitBtn.value = `Wait ${remaining}s...`;

    cooldownInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            submitBtn.value = 'Send message';
            updateSubmitButton();
        } else {
            submitBtn.value = `Wait ${remaining}s...`;
        }
    }, 1000);
}