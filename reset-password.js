document.addEventListener('DOMContentLoaded', function() {
    const resetPasswordForm = document.getElementById('reset-password-form');

    // Brauzer ünvanından tokeni götürürük
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    resetPasswordForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password_confirm').value;

        // Şifrələrin eyni olub-olmadığını yoxlayırıq
        if (password !== passwordConfirm) {
            alert('Daxil etdiyiniz şifrələr eyni deyil!');
            return;
        }

        // Yeni şifrəni token ilə birlikdə backend-ə göndəririk
        fetch(`http://127.0.0.1:5000/api/reset-password/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password }),
            credentials: 'include'
        })
        .then(response => response.json())
        .then(result => {
            alert(result.message);
            // Uğurlu olarsa, login səhifəsinə yönləndiririk
            if (result.message === 'Şifrəniz uğurla yeniləndi!') {
                window.location.href = 'login.html';
            }
        })
        .catch(error => {
            console.error('Xəta:', error);
            alert('Şifrə yenilənərkən xəta baş verdi.');
        });
    });
});