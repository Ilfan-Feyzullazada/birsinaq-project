document.addEventListener('DOMContentLoaded', function() {
    const forgotPasswordForm = document.getElementById('forgot-password-form');

    forgotPasswordForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(forgotPasswordForm);
        const data = Object.fromEntries(formData.entries());

        fetch('http://127.0.0.1:5000/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        })
        .then(response => response.json())
        .then(result => {
            alert(result.message);
        })
        .catch(error => {
            console.error('Xəta:', error);
            alert('Sorğu zamanı xəta baş verdi.');
        });
    });
});