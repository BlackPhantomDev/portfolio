const fields = document.querySelectorAll('.form-field input, .form-field textarea');
const submitBtn = document.getElementById('submit-form');
const checkbox = document.getElementById('accept-privacy-policy');
const footerYear = document.getElementById('footer-year');
const date = new Date();

function init() {
    footerYear.innerText = date.getFullYear();
    updateSubmitButton();   // beim Laden direkt einmal prüfen
}

document.querySelector('#to-contact button').addEventListener('click', () => {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
});

function updateSubmitButton() {
    const allFieldsValid = Array.from(fields).every(field => {
        return field.value.trim() !== '' && field.checkValidity();
    });
    const checkboxChecked = checkbox.checked;

    if (allFieldsValid && checkboxChecked) {
        submitBtn.classList.remove('disabled');
    } else {
        submitBtn.classList.add('disabled');
    }
}

fields.forEach(field => {
    const validate = () => {
        const wrapper = field.closest('.form-field');
        wrapper.classList.remove('is-valid', 'is-invalid');

        if (field.value.trim() === '') {
            if (field.required) wrapper.classList.add('is-invalid');
        } else if (!field.checkValidity()) {
            wrapper.classList.add('is-invalid');
        }

        updateSubmitButton();   // nach jeder Validierung Button-Status updaten
    };

    field.addEventListener('blur', validate);
    field.addEventListener('input', validate);
});

checkbox.addEventListener('change', updateSubmitButton);